const Site = require("../models/Site");
const Customer = require("../models/Customer");

const DEFAULT_SITE_NAME = "Default Site";

const ensureDefaultSite = async () => {
  let defaultSite = await Site.findOne({ isDefault: true }).lean();

  if (!defaultSite) {
    const existing = await Site.findOne({ name: DEFAULT_SITE_NAME }).lean();
    if (existing) {
      await Site.updateOne({ _id: existing._id }, { $set: { isDefault: true, isActive: true } });
      defaultSite = await Site.findById(existing._id).lean();
    } else {
      const created = await Site.create({
        name: DEFAULT_SITE_NAME,
        isDefault: true,
        isActive: true
      });
      defaultSite = created.toObject();
    }
  }

  await Customer.updateMany(
    {
      $or: [{ siteId: { $exists: false } }, { siteId: null }]
    },
    {
      $set: { siteId: defaultSite._id }
    }
  );

  return defaultSite;
};

const getDefaultSiteId = async () => {
  const defaultSite = await ensureDefaultSite();
  return defaultSite._id;
};

module.exports = {
  DEFAULT_SITE_NAME,
  ensureDefaultSite,
  getDefaultSiteId
};
