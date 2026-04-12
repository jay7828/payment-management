const Bill = require("../models/Bill");
const Customer = require("../models/Customer");
const Payment = require("../models/Payment");
const { calculateBillDue } = require("../utils/due");
const { ensureMonthKey, getCurrentMonthKey } = require("../utils/month");

const ALLOWED_MODES = ["CASH", "UPI", "BANK", "OTHER"];

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const parsePositiveAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return roundCurrency(parsed);
};

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

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

const createBill = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const amount = parsePositiveAmount(req.body.amount);

    if (!amount) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const monthInput = String(req.body.monthKey || getCurrentMonthKey()).trim();
    let monthKey;
    try {
      monthKey = ensureMonthKey(monthInput);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const billedDate = req.body.billedDate ? new Date(req.body.billedDate) : new Date();
    if (Number.isNaN(billedDate.getTime())) {
      return res.status(400).json({ message: "billedDate is invalid" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const existingBill = await Bill.findOne({ customerId, monthKey });
    if (existingBill) {
      return res.status(409).json({ message: "Bill already exists for this customer and month" });
    }

    const bill = new Bill({
      customerId,
      monthKey,
      billedDate,
      amount,
      notes: String(req.body.notes || "").trim()
    });

    let appliedCredit = 0;
    if (customer.creditBalance > 0) {
      appliedCredit = roundCurrency(Math.min(customer.creditBalance, amount));
      bill.paidAmount = appliedCredit;
      customer.creditBalance = roundCurrency(customer.creditBalance - appliedCredit);
      await customer.save();
    }

    await bill.save();

    return res.status(201).json({
      message: "Bill created successfully",
      bill: serializeBill(bill),
      appliedCredit,
      customerCreditBalance: roundCurrency(customer.creditBalance)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Bill already exists for this customer and month" });
    }
    return next(error);
  }
};

const recordPayment = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const amount = parsePositiveAmount(req.body.amount);

    if (!amount) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return res.status(400).json({ message: "paymentDate is invalid" });
    }

    const mode = String(req.body.mode || "CASH").toUpperCase();
    if (!ALLOWED_MODES.includes(mode)) {
      return res.status(400).json({ message: `mode must be one of: ${ALLOWED_MODES.join(", ")}` });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    let bill = null;

    if (req.body.billId) {
      bill = await Bill.findOne({ _id: req.body.billId, customerId });
      if (!bill) {
        return res.status(404).json({ message: "Bill not found for this customer" });
      }
    } else if (req.body.monthKey) {
      let monthKey;
      try {
        monthKey = ensureMonthKey(String(req.body.monthKey).trim());
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      bill = await Bill.findOne({ customerId, monthKey });
      if (!bill) {
        return res.status(404).json({ message: "No bill found for this month" });
      }
    } else {
      bill = await Bill.findOne({ customerId, status: { $ne: "PAID" } }).sort({ monthKey: 1, billedDate: 1 });
    }

    let appliedToBill = 0;
    let extraCredit = amount;

    if (bill) {
      const dueAmount = roundCurrency(calculateBillDue(bill));
      appliedToBill = roundCurrency(Math.min(amount, dueAmount));
      extraCredit = roundCurrency(amount - appliedToBill);

      if (appliedToBill > 0) {
        bill.paidAmount = roundCurrency(bill.paidAmount + appliedToBill);
      }
      bill.lastPaymentDate = paymentDate;
      await bill.save();
    }

    if (extraCredit > 0) {
      customer.creditBalance = roundCurrency(customer.creditBalance + extraCredit);
      await customer.save();
    }

    const payment = await Payment.create({
      customerId,
      billId: bill ? bill._id : null,
      amount,
      appliedToBill,
      extraCredit,
      paymentDate,
      mode,
      notes: String(req.body.notes || "").trim()
    });

    return res.status(201).json({
      message: bill
        ? "Payment recorded successfully"
        : "Payment added as advance credit because no unpaid bill was found",
      payment: serializePayment(payment),
      bill: bill ? serializeBill(bill) : null,
      customerCreditBalance: roundCurrency(customer.creditBalance)
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createBill,
  recordPayment
};
