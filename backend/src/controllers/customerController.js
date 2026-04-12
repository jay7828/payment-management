const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const { getCurrentMonthKey } = require("../utils/month");
const { calculateBillDue, calculateCustomerTotalDue } = require("../utils/due");

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

const serializeCustomerCard = (customer, bills, currentMonthKey) => {
  const totalDue = roundCurrency(calculateCustomerTotalDue(customer, bills));
  const status = deriveCardStatus(bills, currentMonthKey, totalDue, customer.updatedAt || customer.createdAt);
  const unpaidStats = getUnpaidBillStats(bills);

  return {
    id: customer._id.toString(),
    name: customer.name,
    mobile: customer.mobile,
    address: customer.address || "",
    otherInfo: customer.otherInfo || "",
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
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };

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

    const currentMonthKey = getCurrentMonthKey();
    const customerCards = customers.map((customer) => {
      const customerBills = billsByCustomer.get(customer._id.toString()) || [];
      return serializeCustomerCard(customer, customerBills, currentMonthKey);
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

    if (!name || !mobile) {
      return res.status(400).json({ message: "name and mobile are required" });
    }

    const customer = await Customer.create({
      name,
      mobile,
      address: String(req.body.address || "").trim(),
      otherInfo: String(req.body.otherInfo || "").trim(),
      openingBalance: parseNonNegativeNumber(
        req.body.openingBalance !== undefined ? req.body.openingBalance : req.body.previousBalance,
        0
      )
    });

    return res.status(201).json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        mobile: customer.mobile,
        address: customer.address,
        otherInfo: customer.otherInfo,
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

    return res.json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        mobile: customer.mobile,
        address: customer.address || "",
        otherInfo: customer.otherInfo || "",
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
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      updates.name = String(req.body.name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "mobile")) {
      updates.mobile = String(req.body.mobile || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "address")) {
      updates.address = String(req.body.address || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "otherInfo")) {
      updates.otherInfo = String(req.body.otherInfo || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "openingBalance")) {
      updates.openingBalance = parseNonNegativeNumber(req.body.openingBalance, 0);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    const customer = await Customer.findByIdAndUpdate(customerId, updates, {
      new: true,
      runValidators: true
    }).lean();

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const bills = await Bill.find({ customerId }).lean();
    const unpaidStats = getUnpaidBillStats(bills);

    return res.json({
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        mobile: customer.mobile,
        address: customer.address || "",
        otherInfo: customer.otherInfo || "",
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

module.exports = {
  listCustomers,
  createCustomer,
  getCustomerDetails,
  updateCustomer
};
