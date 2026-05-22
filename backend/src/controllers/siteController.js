const Site = require("../models/Site");
const Customer = require("../models/Customer");
const { ensureDefaultSite } = require("../utils/defaultSite");

const serializeSite = (site) => ({
  id: site._id.toString(),
  name: site.name,
  isDefault: Boolean(site.isDefault),
  isActive: Boolean(site.isActive),
  createdAt: site.createdAt ? new Date(site.createdAt).toISOString() : null,
  updatedAt: site.updatedAt ? new Date(site.updatedAt).toISOString() : null
});

const listSites = async (req, res, next) => {
  try {
    await ensureDefaultSite();
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };
    const sites = await Site.find(filter).sort({ isDefault: -1, name: 1 }).lean();
    return res.json({ sites: sites.map(serializeSite) });
  } catch (error) {
    return next(error);
  }
};

const createSite = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const site = await Site.create({ name, isDefault: false, isActive: true });
    return res.status(201).json({ site: serializeSite(site) });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "A site with this name already exists" });
    }
    return next(error);
  }
};

const updateSite = async (req, res, next) => {
  try {
    const { siteId } = req.params;
    const setUpdates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({ message: "name cannot be empty" });
      }
      setUpdates.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      setUpdates.isActive = Boolean(req.body.isActive);
    }

    if (!Object.keys(setUpdates).length) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    const existing = await Site.findById(siteId).lean();
    if (!existing) {
      return res.status(404).json({ message: "Site not found" });
    }

    if (existing.isDefault && setUpdates.isActive === false) {
      return res.status(400).json({ message: "Default site cannot be deactivated" });
    }

    const site = await Site.findByIdAndUpdate(siteId, { $set: setUpdates }, { new: true, runValidators: true }).lean();
    return res.json({ site: serializeSite(site) });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "A site with this name already exists" });
    }
    return next(error);
  }
};

const deleteSite = async (req, res, next) => {
  try {
    const { siteId } = req.params;
    const site = await Site.findById(siteId).lean();

    if (!site) {
      return res.status(404).json({ message: "Site not found" });
    }

    if (site.isDefault) {
      return res.status(400).json({ message: "Default site cannot be deleted" });
    }

    const defaultSite = await ensureDefaultSite();
    const reassigned = await Customer.updateMany({ siteId: site._id }, { $set: { siteId: defaultSite._id } });

    await Site.deleteOne({ _id: siteId });

    return res.json({
      message: "Site deleted. Customers moved to default site.",
      customersReassigned: reassigned.modifiedCount || 0
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSites,
  createSite,
  updateSite,
  deleteSite
};
