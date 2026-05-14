const mongoose = require("mongoose");
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

const refreshBillLastPaymentDate = async (billId, customerId, session) => {
  const bill = await Bill.findOne({ _id: billId, customerId }).session(session);
  if (!bill) {
    return;
  }

  const latest = await Payment.findOne({ billId, customerId })
    .sort({ paymentDate: -1, createdAt: -1 })
    .session(session);

  bill.lastPaymentDate = latest ? latest.paymentDate : null;
  await bill.save({ session });
};

const updateBill = async (req, res, next) => {
  try {
    const { customerId, billId } = req.params;
    const bill = await Bill.findOne({ _id: billId, customerId });
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    const hasPatchField = ["monthKey", "amount", "notes", "billedDate"].some((key) =>
      Object.prototype.hasOwnProperty.call(req.body, key)
    );
    if (!hasPatchField) {
      return res.status(400).json({ message: "No bill fields to update" });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "monthKey")) {
      const monthInput = String(req.body.monthKey || "").trim();
      let monthKey;
      try {
        monthKey = ensureMonthKey(monthInput);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      if (monthKey !== bill.monthKey) {
        const clash = await Bill.findOne({ customerId, monthKey, _id: { $ne: bill._id } }).lean();
        if (clash) {
          return res.status(409).json({ message: "Another bill already uses this month" });
        }
        bill.monthKey = monthKey;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "amount")) {
      const amount = parsePositiveAmount(req.body.amount);
      if (!amount) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }
      if (roundCurrency(amount) < roundCurrency(bill.paidAmount)) {
        return res.status(400).json({
          message: "amount cannot be less than what is already paid on this bill"
        });
      }
      bill.amount = amount;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
      bill.notes = String(req.body.notes || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "billedDate")) {
      const billedDate = new Date(req.body.billedDate);
      if (Number.isNaN(billedDate.getTime())) {
        return res.status(400).json({ message: "billedDate is invalid" });
      }
      bill.billedDate = billedDate;
    }

    await bill.save();
    return res.json({ bill: serializeBill(bill) });
  } catch (error) {
    return next(error);
  }
};

const deleteBill = async (req, res, next) => {
  const { customerId, billId } = req.params;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const bill = await Bill.findOne({ _id: billId, customerId }).session(session);
      if (!bill) {
        throw Object.assign(new Error("Bill not found"), { statusCode: 404 });
      }

      const payments = await Payment.find({ billId: bill._id, customerId }).session(session);
      const sumApplied = payments.reduce((sum, row) => sum + roundCurrency(row.appliedToBill), 0);
      const sumExtra = payments.reduce((sum, row) => sum + roundCurrency(row.extraCredit), 0);

      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        throw Object.assign(new Error("Customer not found"), { statusCode: 404 });
      }

      const creditFromBillCreation = roundCurrency(bill.paidAmount - sumApplied);
      customer.creditBalance = roundCurrency(customer.creditBalance - sumExtra + creditFromBillCreation);
      if (customer.creditBalance < 0) {
        customer.creditBalance = 0;
      }
      await customer.save({ session });

      await Payment.deleteMany({ billId: bill._id, customerId }).session(session);
      await Bill.deleteOne({ _id: bill._id }).session(session);
    });

    return res.json({ message: "Bill and its payment entries were removed" });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  } finally {
    session.endSession();
  }
};

const deletePayment = async (req, res, next) => {
  const { customerId, paymentId } = req.params;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ _id: paymentId, customerId }).session(session);
      if (!payment) {
        throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
      }

      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        throw Object.assign(new Error("Customer not found"), { statusCode: 404 });
      }

      if (payment.billId) {
        const bill = await Bill.findOne({ _id: payment.billId, customerId }).session(session);
        if (bill) {
          bill.paidAmount = roundCurrency(bill.paidAmount - payment.appliedToBill);
          if (bill.paidAmount < 0) {
            bill.paidAmount = 0;
          }
          await bill.save({ session });
        }
      }

      customer.creditBalance = roundCurrency(customer.creditBalance - payment.extraCredit);
      if (customer.creditBalance < 0) {
        customer.creditBalance = 0;
      }
      await customer.save({ session });

      const billIdForRefresh = payment.billId;
      await Payment.deleteOne({ _id: paymentId }).session(session);

      if (billIdForRefresh) {
        await refreshBillLastPaymentDate(billIdForRefresh, customerId, session);
      }
    });

    return res.json({ message: "Payment removed" });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  } finally {
    session.endSession();
  }
};

const updatePayment = async (req, res, next) => {
  const { customerId, paymentId } = req.params;
  const session = await mongoose.startSession();

  try {
    const amountChanging = Object.prototype.hasOwnProperty.call(req.body, "amount");
    const hasMetaPatch = ["mode", "notes", "paymentDate"].some((key) =>
      Object.prototype.hasOwnProperty.call(req.body, key)
    );
    if (!amountChanging && !hasMetaPatch) {
      return res.status(400).json({ message: "No payment fields to update" });
    }

    if (!amountChanging) {
      await session.withTransaction(async () => {
        const payment = await Payment.findOne({ _id: paymentId, customerId }).session(session);
        if (!payment) {
          throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "mode")) {
          const mode = String(req.body.mode || "CASH").toUpperCase();
          if (!ALLOWED_MODES.includes(mode)) {
            throw Object.assign(new Error(`mode must be one of: ${ALLOWED_MODES.join(", ")}`), {
              statusCode: 400
            });
          }
          payment.mode = mode;
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
          payment.notes = String(req.body.notes || "").trim();
        }

        if (Object.prototype.hasOwnProperty.call(req.body, "paymentDate")) {
          const paymentDate = new Date(req.body.paymentDate);
          if (Number.isNaN(paymentDate.getTime())) {
            throw Object.assign(new Error("paymentDate is invalid"), { statusCode: 400 });
          }
          payment.paymentDate = paymentDate;
        }

        await payment.save({ session });

        if (payment.billId) {
          await refreshBillLastPaymentDate(payment.billId, customerId, session);
        }
      });

      const payment = await Payment.findOne({ _id: paymentId, customerId }).lean();
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      return res.json({ payment: serializePayment(payment) });
    }

    const newAmount = parsePositiveAmount(req.body.amount);
    if (!newAmount) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    let updatedPaymentDoc = null;

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ _id: paymentId, customerId }).session(session);
      if (!payment) {
        throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
      }

      const customer = await Customer.findById(customerId).session(session);
      if (!customer) {
        throw Object.assign(new Error("Customer not found"), { statusCode: 404 });
      }

      let bill = null;
      if (payment.billId) {
        bill = await Bill.findOne({ _id: payment.billId, customerId }).session(session);
        if (bill) {
          bill.paidAmount = roundCurrency(bill.paidAmount - payment.appliedToBill);
          if (bill.paidAmount < 0) {
            bill.paidAmount = 0;
          }
          await bill.save({ session });
        }
      }

      customer.creditBalance = roundCurrency(customer.creditBalance - payment.extraCredit);
      if (customer.creditBalance < 0) {
        customer.creditBalance = 0;
      }
      await customer.save({ session });

      const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : payment.paymentDate;
      if (Number.isNaN(paymentDate.getTime())) {
        throw Object.assign(new Error("paymentDate is invalid"), { statusCode: 400 });
      }

      const mode = String(req.body.mode || payment.mode || "CASH").toUpperCase();
      if (!ALLOWED_MODES.includes(mode)) {
        throw Object.assign(new Error(`mode must be one of: ${ALLOWED_MODES.join(", ")}`), { statusCode: 400 });
      }

      let appliedToBill = 0;
      let extraCredit = newAmount;

      if (bill) {
        const dueAmount = roundCurrency(calculateBillDue(bill));
        appliedToBill = roundCurrency(Math.min(newAmount, dueAmount));
        extraCredit = roundCurrency(newAmount - appliedToBill);

        if (appliedToBill > 0) {
          bill.paidAmount = roundCurrency(bill.paidAmount + appliedToBill);
        }
        bill.lastPaymentDate = paymentDate;
        await bill.save({ session });
      }

      if (extraCredit > 0) {
        customer.creditBalance = roundCurrency(customer.creditBalance + extraCredit);
        await customer.save({ session });
      }

      payment.amount = newAmount;
      payment.appliedToBill = appliedToBill;
      payment.extraCredit = extraCredit;
      payment.paymentDate = paymentDate;
      payment.mode = mode;
      if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
        payment.notes = String(req.body.notes || "").trim();
      }

      await payment.save({ session });
      updatedPaymentDoc = payment.toObject();

      if (payment.billId) {
        await refreshBillLastPaymentDate(payment.billId, customerId, session);
      }
    });

    return res.json({
      payment: serializePayment(updatedPaymentDoc),
      customerCreditBalance: roundCurrency(
        (await Customer.findById(customerId).select("creditBalance").lean())?.creditBalance || 0
      )
    });
  } catch (error) {
    if (error.statusCode === 400 || error.statusCode === 404) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  createBill,
  recordPayment,
  updateBill,
  deleteBill,
  updatePayment,
  deletePayment
};
