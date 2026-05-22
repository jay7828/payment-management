const dayjs = require("dayjs");
const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const Site = require("../models/Site");
const Employee = require("../models/Employee");
const AttendanceRecord = require("../models/AttendanceRecord");
const { calculateBillDue, calculateCustomerTotalDue } = require("../utils/due");
const { getCurrentMonthKey, ensureMonthKey } = require("../utils/month");
const { REPORT_EMAIL_TO } = require("../config/env");
const { sendReportEmail, isEmailConfigured } = require("../utils/email");

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

const buildSalesReport = async (monthKey) => {
  const monthStart = dayjs(`${monthKey}-01`).startOf("month");
  const monthEnd = monthStart.endOf("month");

  const [payments, bills, newCustomers, allCustomers, sites, employees, attendanceRecords] = await Promise.all([
    Payment.find({
      paymentDate: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() }
    }).lean(),
    Bill.find({ monthKey }).lean(),
    Customer.find({
      createdAt: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() }
    }).lean(),
    Customer.find({ isActive: true }).lean(),
    Site.find({ isActive: true }).lean(),
    Employee.find({ isActive: true }).lean(),
    AttendanceRecord.find({ monthKey }).lean()
  ]);

  const totalCollection = roundCurrency(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const totalBilled = roundCurrency(bills.reduce((sum, b) => sum + Number(b.amount || 0), 0));
  const totalBillPaid = roundCurrency(bills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0));
  const totalBillDue = roundCurrency(bills.reduce((sum, b) => sum + calculateBillDue(b), 0));

  const paymentsByMode = {};
  for (const payment of payments) {
    const mode = payment.mode || "OTHER";
    paymentsByMode[mode] = roundCurrency((paymentsByMode[mode] || 0) + Number(payment.amount || 0));
  }

  const siteMap = new Map(sites.map((s) => [s._id.toString(), s.name]));
  const customerById = new Map(allCustomers.map((c) => [c._id.toString(), c]));
  const collectionBySite = {};

  for (const payment of payments) {
    const customer = customerById.get(payment.customerId.toString());
    const siteName = customer && customer.siteId ? siteMap.get(customer.siteId.toString()) || "Unassigned" : "Unassigned";
    collectionBySite[siteName] = roundCurrency((collectionBySite[siteName] || 0) + Number(payment.amount || 0));
  }

  const customerIds = allCustomers.map((c) => c._id);
  const allBills = customerIds.length
    ? await Bill.find({ customerId: { $in: customerIds } }).lean()
    : [];
  const billsByCustomer = new Map();
  for (const bill of allBills) {
    const key = bill.customerId.toString();
    if (!billsByCustomer.has(key)) billsByCustomer.set(key, []);
    billsByCustomer.get(key).push(bill);
  }

  let totalOutstandingDue = 0;
  for (const customer of allCustomers) {
    const customerBills = billsByCustomer.get(customer._id.toString()) || [];
    totalOutstandingDue += calculateCustomerTotalDue(customer, customerBills);
  }
  totalOutstandingDue = roundCurrency(totalOutstandingDue);

  const attendanceSummary = {
    employeesTracked: employees.length,
    recordsMarked: attendanceRecords.length,
    present: attendanceRecords.filter((r) => r.status === "PRESENT").length,
    absent: attendanceRecords.filter((r) => r.status === "ABSENT").length,
    halfDay: attendanceRecords.filter((r) => r.status === "HALF_DAY").length,
    leave: attendanceRecords.filter((r) => r.status === "LEAVE").length
  };

  return {
    monthKey,
    monthLabel: monthStart.format("MMMM YYYY"),
    generatedAt: new Date().toISOString(),
    sales: {
      totalCollection,
      transactionCount: payments.length,
      paymentsByMode,
      collectionBySite
    },
    billing: {
      billsCreated: bills.length,
      totalBilled,
      totalBillPaid,
      totalBillDue
    },
    customers: {
      newCustomers: newCustomers.length,
      activeCustomers: allCustomers.length,
      totalOutstandingDue
    },
    attendance: attendanceSummary
  };
};

const formatSalesReportText = (report) => {
  const lines = [
    `Monthly Sales Report — ${report.monthLabel}`,
    `Generated: ${dayjs(report.generatedAt).format("DD MMM YYYY, HH:mm")}`,
    "",
    "COLLECTIONS",
    `Total collected: ₹${report.sales.totalCollection.toFixed(2)}`,
    `Transactions: ${report.sales.transactionCount}`,
    ...Object.entries(report.sales.paymentsByMode).map(([mode, amount]) => `  ${mode}: ₹${amount.toFixed(2)}`),
    "",
    "BILLING",
    `Bills created: ${report.billing.billsCreated}`,
    `Total billed: ₹${report.billing.totalBilled.toFixed(2)}`,
    `Paid on bills: ₹${report.billing.totalBillPaid.toFixed(2)}`,
    `Due on bills: ₹${report.billing.totalBillDue.toFixed(2)}`,
    "",
    "CUSTOMERS",
    `New customers: ${report.customers.newCustomers}`,
    `Active customers: ${report.customers.activeCustomers}`,
    `Total outstanding due: ₹${report.customers.totalOutstandingDue.toFixed(2)}`,
    "",
    "COLLECTION BY SITE",
    ...Object.entries(report.sales.collectionBySite).map(([site, amount]) => `  ${site}: ₹${amount.toFixed(2)}`),
    "",
    "ATTENDANCE",
    `Employees: ${report.attendance.employeesTracked}`,
    `Marked days: ${report.attendance.recordsMarked}`,
    `Present: ${report.attendance.present} | Absent: ${report.attendance.absent} | Half: ${report.attendance.halfDay} | Leave: ${report.attendance.leave}`
  ];

  return lines.join("\n");
};

const formatSalesReportHtml = (report) => {
  const text = formatSalesReportText(report);
  return `<pre style="font-family:monospace;font-size:14px;line-height:1.5">${text.replace(/</g, "&lt;")}</pre>`;
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
    const subject = `Monthly Sales Report — ${report.monthLabel}`;
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
