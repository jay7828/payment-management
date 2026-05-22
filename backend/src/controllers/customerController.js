const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const Site = require("../models/Site");
const { getCurrentMonthKey } = require("../utils/month");
const { calculateBillDue, calculateCustomerTotalDue } = require("../utils/due");
const { getDefaultSiteId } = require("../utils/defaultSite");

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const parseNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return roundCurrency(parsed);
};

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const getUnpaidBillStats = (bills) => {
  let unpaidBillsCount = 0;
  let totalUnpaidBillAmount = 0;

  for (const bill of bills) {
    const dueAmount = roundCurrency(calculateBillDue(bill));
    if (dueAmount > 0) {
      unpaidBillsCount += 1;
      totalUnpaidBillAmount += dueAmount;
    }
  }

  return {
    unpaidBillsCount,
    totalUnpaidBillAmount: roundCurrency(totalUnpaidBillAmount)
  };
};

const serializeBill = (bill) => ({
  id: bill._id.toString(),
  customerId: bill.customerId.toString(),
  monthKey: bill.monthKey,
  billedDate: toIsoOrNull(bill.billedDate),
  amount: roundCurrency(bill.amount),
  paidAmount: roundCurrency(bill.paidAmount),
  dueAmount: roundCurrency(calculateBillDue(bill)),
  status: bill.status,
  lastPaymentDate: toIsoOrNull(bill.lastPaymentDate),
  notes: bill.notes || ""
});

const serializePayment = (payment) => ({
  id: payment._id.toString(),
  customerId: payment.customerId.toString(),
  billId: payment.billId ? payment.billId.toString() : null,
  amount: roundCurrency(payment.amount),
  appliedToBill: roundCurrency(payment.appliedToBill),
  extraCredit: roundCurrency(payment.extraCredit),
  paymentDate: toIsoOrNull(payment.paymentDate),
  mode: payment.mode,
  notes: payment.notes || ""
});

const deriveCardStatus = (bills, currentMonthKey, totalDue, fallbackDate) => {
  const currentMonthBill = bills.find((bill) => bill.monthKey === currentMonthKey);

  if (currentMonthBill) {
    const currentDue = calculateBillDue(currentMonthBill);
    if (currentDue > 0) {
      return {
        currentMonthStatus: "BILLED",
        statusDate: toIsoOrNull(currentMonthBill.billedDate)
      };
    }

    return {
      currentMonthStatus: "PAID",
      statusDate: toIsoOrNull(currentMonthBill.lastPaymentDate || currentMonthBill.billedDate)
    };
  }

  if (totalDue > 0) {
    const openBill = bills.find((bill) => calculateBillDue(bill) > 0);
    return {
      currentMonthStatus: "BILLED",
      statusDate: toIsoOrNull(openBill ? openBill.billedDate : fallbackDate)
    };
  }

  return {
    currentMonthStatus: "PAID",
    statusDate: toIsoOrNull(fallbackDate)
  };
};

const serializeCustomerCard = (customer, bills, currentMonthKey, siteMap) => {
  const totalDue = roundCurrency(calculateCustomerTotalDue(customer, bills));
  const status = deriveCardStatus(bills, currentMonthKey, totalDue, customer.updatedAt || customer.createdAt);
  const unpaidStats = getUnpaidBillStats(bills);
  const siteId = customer.siteId ? customer.siteId.toString() : null;
  const site = siteId && siteMap ? siteMap.get(siteId) : null;

  return {
    id: customer._id.toString(),
    name: customer.name,
    mobile: customer.mobile || "",
    address: customer.address || "",
    otherInfo: customer.otherInfo || "",
    siteId,
    siteName: site ? site.name : "",
    isActive: Boolean(customer.isActive),
    previousBalance: roundCurrency(customer.openingBalance),
    openingBalance: roundCurrency(customer.openingBalance),
    creditBalance: roundCurrency(customer.creditBalance),
    totalDue,
    unpaidBillsCount: unpaidStats.unpaidBillsCount,
    totalUnpaidBillAmount: unpaidStats.totalUnpaidBillAmount,
    currentMonthStatus: status.currentMonthStatus,
    statusDate: status.statusDate,
    createdAt: toIsoOrNull(customer.createdAt),
    updatedAt: toIsoOrNull(customer.updatedAt)
  };
};

const isDuplicateMobileError = (error) => Boolean(error && error.code === 11000 && error.keyPattern && error.keyPattern.mobile);

const listCustomers = async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const siteId = String(req.query.siteId || "").trim();
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };

    if (siteId) {
      filter.siteId = siteId;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { mobile: regex }, { address: regex }, { otherInfo: regex }];
    }

    const customers = await Customer.find(filter).sort({ name: 1, createdAt: -1 }).lean();

    if (!customers.length) {
      return res.json({ customers: [] });
    }

    const customerIds = customers.map((customer) => customer._id);
    const bills = await Bill.find({ customerId: { $in: customerIds } })
      .sort({ monthKey: -1, billedDate: -1 })
      .lean();

    const billsByCustomer = new Map();

    for (const bill of bills) {
      const key = bill.customerId.toString();
      if (!billsByCustomer.has(key)) {
        billsByCustomer.set(key, []);
      }
      billsByCustomer.get(key).push(bill);
    }

    const siteIds = [...new Set(customers.map((c) => c.siteId).filter(Boolean))];
    const sites = siteIds.length ? await Site.find({ _id: { $in: siteIds } }).lean() : [];
    const siteMap = new Map(sites.map((site) => [site._id.toString(), site]));

    const currentMonthKey = getCurrentMonthKey();
    const customerCards = customers.map((customer) => {
      const customerBills = billsByCustomer.get(customer._id.toString()) || [];
      return serializeCustomerCard(customer, customerBills, currentMonthKey, siteMap);
    });

    return res.json({ customers: customerCards });
  } catch (error) {
    return next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const mobile = String(req.body.mobile || "").trim();

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    let siteId = req.body.siteId ? String(req.body.siteId) : null;
    if (siteId) {
      const site = await Site.findById(siteId).lean();
      if (!site || !site.isActive) {
        return res.status(400).json({ message: "Invalid or inactive site selected" });
      }
    } else {
      siteId = await getDefaultSiteId();
    }

    const customerPayload = {
      name,
      address: String(req.body.address || "").trim(),
      otherInfo: String(req.body.otherInfo || "").trim(),
      openingBalance: parseNonNegativeNumber(
        req.body.openingBalance !== undefined ? req.body.openingBalance : req.body.previousBalance,
        0
      ),
      siteId
    };

    if (mobile) {
      customerPayload.mobile = mobile;
    }

    const customer = await Customer.create(customerPayload);
    const site = await Site.findById(siteId).lean();

    return res.status(201).json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        mobile: customer.mobile || "",
        address: customer.address,
        otherInfo: customer.otherInfo,
        siteId: siteId.toString(),
        siteName: site ? site.name : "",
        openingBalance: roundCurrency(customer.openingBalance),
        previousBalance: roundCurrency(customer.openingBalance),
        creditBalance: roundCurrency(customer.creditBalance),
        totalDue: roundCurrency(customer.openingBalance),
        unpaidBillsCount: 0,
        totalUnpaidBillAmount: 0
      }
    });
  } catch (error) {
    if (isDuplicateMobileError(error)) {
      return res.status(409).json({ message: "A customer with this mobile number already exists" });
    }
    return next(error);
  }
};

const getCustomerDetails = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).lean();
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const [bills, payments] = await Promise.all([
      Bill.find({ customerId }).sort({ monthKey: -1, billedDate: -1 }).lean(),
      Payment.find({ customerId }).sort({ paymentDate: -1, createdAt: -1 }).limit(100).lean()
    ]);

    const totalDue = roundCurrency(calculateCustomerTotalDue(customer, bills));
    const unpaidStats = getUnpaidBillStats(bills);
    const site = customer.siteId ? await Site.findById(customer.siteId).lean() : null;

    return res.json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        mobile: customer.mobile || "",
        address: customer.address || "",
        otherInfo: customer.otherInfo || "",
        siteId: customer.siteId ? customer.siteId.toString() : null,
        siteName: site ? site.name : "",
        isActive: Boolean(customer.isActive),
        openingBalance: roundCurrency(customer.openingBalance),
        previousBalance: roundCurrency(customer.openingBalance),
        creditBalance: roundCurrency(customer.creditBalance),
        totalDue,
        unpaidBillsCount: unpaidStats.unpaidBillsCount,
        totalUnpaidBillAmount: unpaidStats.totalUnpaidBillAmount,
        createdAt: toIsoOrNull(customer.createdAt),
        updatedAt: toIsoOrNull(customer.updatedAt)
      },
      bills: bills.map(serializeBill),
      payments: payments.map(serializePayment)
    });
  } catch (error) {
    return next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const setUpdates = {};
    const unsetUpdates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      setUpdates.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "mobile")) {
      const mobile = String(req.body.mobile || "").trim();
      if (mobile) {
        setUpdates.mobile = mobile;
      } else {
        unsetUpdates.mobile = "";
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "address")) {
      setUpdates.address = String(req.body.address || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "otherInfo")) {
      setUpdates.otherInfo = String(req.body.otherInfo || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "openingBalance")) {
      setUpdates.openingBalance = parseNonNegativeNumber(req.body.openingBalance, 0);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      setUpdates.isActive = Boolean(req.body.isActive);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "siteId")) {
      const siteId = String(req.body.siteId || "");
      if (!siteId) {
        return res.status(400).json({ message: "siteId cannot be empty" });
      }
      const site = await Site.findById(siteId).lean();
      if (!site || !site.isActive) {
        return res.status(400).json({ message: "Invalid or inactive site selected" });
      }
      setUpdates.siteId = siteId;
    }

    const updateQuery = {};
    if (Object.keys(setUpdates).length) {
      updateQuery.$set = setUpdates;
    }
    if (Object.keys(unsetUpdates).length) {
      updateQuery.$unset = unsetUpdates;
    }

    if (!Object.keys(updateQuery).length) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    const customer = await Customer.findByIdAndUpdate(customerId, updateQuery, {
      new: true,
      runValidators: true
    }).lean();

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const bills = await Bill.find({ customerId }).lean();
    const unpaidStats = getUnpaidBillStats(bills);
    const site = customer.siteId ? await Site.findById(customer.siteId).lean() : null;

    return res.json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        mobile: customer.mobile || "",
        address: customer.address || "",
        otherInfo: customer.otherInfo || "",
        siteId: customer.siteId ? customer.siteId.toString() : null,
        siteName: site ? site.name : "",
        isActive: Boolean(customer.isActive),
        openingBalance: roundCurrency(customer.openingBalance),
        previousBalance: roundCurrency(customer.openingBalance),
        creditBalance: roundCurrency(customer.creditBalance),
        totalDue: roundCurrency(calculateCustomerTotalDue(customer, bills)),
        unpaidBillsCount: unpaidStats.unpaidBillsCount,
        totalUnpaidBillAmount: unpaidStats.totalUnpaidBillAmount
      }
    });
  } catch (error) {
    if (isDuplicateMobileError(error)) {
      return res.status(409).json({ message: "A customer with this mobile number already exists" });
    }
    return next(error);
  }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).select("_id").lean();
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const [paymentsResult, billsResult] = await Promise.all([
      Payment.deleteMany({ customerId }),
      Bill.deleteMany({ customerId })
    ]);
    await Customer.deleteOne({ _id: customerId });

    return res.json({
      message: "Customer and all related bills and payments were deleted",
      deletedPayments: paymentsResult.deletedCount || 0,
      deletedBills: billsResult.deletedCount || 0
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listCustomers,
  createCustomer,
  getCustomerDetails,
  updateCustomer,
  deleteCustomer
};
