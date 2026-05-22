const dayjs = require("dayjs");
const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const { calculateBillDue, calculateCustomerTotalDue } = require("../utils/due");
const { getCurrentMonthKey, ensureMonthKey } = require("../utils/month");
const { REPORT_EMAIL_TO } = require("../config/env");
const { sendReportEmail, isEmailConfigured } = require("../utils/email");
const { buildSalesReport } = require("../utils/salesReportBuilder");
const { formatSalesReportHtml, formatSalesReportText } = require("../utils/salesReportEmail");

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const getHomeSummary = async (req, res, next) => {
  try {
    const currentMonthKey = getCurrentMonthKey();

    const customers = await Customer.find({ isActive: true }).lean();
    if (!customers.length) {
      return res.json({
        totalCustomers: 0,
        customersWithDue: 0,
        customersPaid: 0,
        totalDue: 0,
        currentMonthCollection: 0,
        dueCustomers: []
      });
    }

    const customerIds = customers.map((customer) => customer._id);

    const [bills, paymentRows] = await Promise.all([
      Bill.find({ customerId: { $in: customerIds } }).sort({ monthKey: -1, billedDate: -1 }).lean(),
      Payment.aggregate([
        {
          $match: {
            paymentDate: {
              $gte: dayjs().startOf("month").toDate(),
              $lte: dayjs().endOf("month").toDate()
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ])
    ]);

    const billsByCustomer = new Map();
    for (const bill of bills) {
      const key = bill.customerId.toString();
      if (!billsByCustomer.has(key)) {
        billsByCustomer.set(key, []);
      }
      billsByCustomer.get(key).push(bill);
    }

    let totalDue = 0;
    let customersWithDue = 0;
    const dueCustomers = [];

    for (const customer of customers) {
      const customerBills = billsByCustomer.get(customer._id.toString()) || [];
      const customerDue = roundCurrency(calculateCustomerTotalDue(customer, customerBills));
      totalDue += customerDue;
      let unpaidBillsCount = 0;
      let totalUnpaidBillAmount = 0;

      for (const bill of customerBills) {
        const dueAmount = roundCurrency(calculateBillDue(bill));
        if (dueAmount > 0) {
          unpaidBillsCount += 1;
          totalUnpaidBillAmount += dueAmount;
        }
      }

      totalUnpaidBillAmount = roundCurrency(totalUnpaidBillAmount);

      const currentMonthBill = customerBills.find((bill) => bill.monthKey === currentMonthKey);
      let currentMonthStatus = "PAID";
      let statusDate = customer.updatedAt || customer.createdAt;

      if (currentMonthBill) {
        if (calculateBillDue(currentMonthBill) > 0) {
          currentMonthStatus = "BILLED";
          statusDate = currentMonthBill.billedDate;
        } else {
          currentMonthStatus = "PAID";
          statusDate = currentMonthBill.lastPaymentDate || currentMonthBill.billedDate;
        }
      } else if (customerDue > 0) {
        currentMonthStatus = "BILLED";
        const firstOpenBill = customerBills.find((bill) => calculateBillDue(bill) > 0);
        statusDate = firstOpenBill ? firstOpenBill.billedDate : customer.createdAt;
      }

      if (customerDue > 0) {
        customersWithDue += 1;
        dueCustomers.push({
          id: customer._id.toString(),
          name: customer.name,
          mobile: customer.mobile,
          totalDue: customerDue,
          unpaidBillsCount,
          totalUnpaidBillAmount,
          currentMonthStatus,
          statusDate: toIsoOrNull(statusDate)
        });
      }
    }

    dueCustomers.sort((a, b) => b.totalDue - a.totalDue);

    return res.json({
      totalCustomers: customers.length,
      customersWithDue,
      customersPaid: customers.length - customersWithDue,
      totalDue: roundCurrency(totalDue),
      currentMonthCollection: roundCurrency(paymentRows[0] ? paymentRows[0].total : 0),
      dueCustomers
    });
  } catch (error) {
    return next(error);
  }
};

const getMonthlyCollections = async (req, res, next) => {
  try {
    const parsedMonths = Number(req.query.months || 6);
    const months = Math.min(24, Math.max(1, Number.isFinite(parsedMonths) ? parsedMonths : 6));

    const startMonth = dayjs().startOf("month").subtract(months - 1, "month");

    const rows = await Payment.aggregate([
      {
        $match: {
          paymentDate: {
            $gte: startMonth.toDate(),
            $lte: dayjs().endOf("month").toDate()
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$paymentDate"
            }
          },
          totalCollection: { $sum: "$amount" },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ]);

    const rowMap = new Map(
      rows.map((row) => [
        row._id,
        {
          totalCollection: roundCurrency(row.totalCollection),
          transactionCount: row.transactionCount
        }
      ])
    );

    const collection = [];

    for (let index = 0; index < months; index += 1) {
      const monthKey = startMonth.add(index, "month").format("YYYY-MM");
      const row = rowMap.get(monthKey);

      collection.push({
        monthKey,
        totalCollection: row ? row.totalCollection : 0,
        transactionCount: row ? row.transactionCount : 0
      });
    }

    return res.json({
      months,
      collection
    });
  } catch (error) {
    return next(error);
  }
};

const getSalesReport = async (req, res, next) => {
  try {
    const monthKey = ensureMonthKey(String(req.query.monthKey || getCurrentMonthKey()));
    const report = await buildSalesReport(monthKey);
    return res.json({
      report,
      emailConfigured: isEmailConfigured(),
      defaultRecipient: REPORT_EMAIL_TO
    });
  } catch (error) {
    if (error.message && error.message.includes("monthKey")) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

const sendSalesReport = async (req, res, next) => {
  try {
    const monthKey = ensureMonthKey(String(req.body.monthKey || getCurrentMonthKey()));
    const to = String(req.body.email || REPORT_EMAIL_TO).trim();

    if (!to) {
      return res.status(400).json({ message: "email recipient is required" });
    }

    const report = await buildSalesReport(monthKey);
    const subject = `Payment Report (Site-wise) — ${report.monthLabel}`;
    const text = formatSalesReportText(report);
    const html = formatSalesReportHtml(report);

    await sendReportEmail({ to, subject, text, html });

    return res.json({
      message: `Sales report for ${report.monthLabel} sent to ${to}`,
      monthKey,
      recipient: to
    });
  } catch (error) {
    if (error.message && error.message.includes("monthKey")) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message && error.message.includes("Email is not configured")) {
      return res.status(503).json({ message: error.message });
    }
    return next(error);
  }
};

module.exports = {
  getHomeSummary,
  getMonthlyCollections,
  getSalesReport,
  sendSalesReport
};
