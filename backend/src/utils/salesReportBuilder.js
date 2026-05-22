const dayjs = require("dayjs");
const Customer = require("../models/Customer");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const Site = require("../models/Site");
const Employee = require("../models/Employee");
const AttendanceRecord = require("../models/AttendanceRecord");
const { calculateBillDue, calculateCustomerTotalDue } = require("../utils/due");

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const UNASSIGNED_SITE_ID = "unassigned";
const UNASSIGNED_SITE_NAME = "Unassigned";

const getCustomerSiteKey = (customer) => {
  if (customer && customer.siteId) {
    return customer.siteId.toString();
  }
  return UNASSIGNED_SITE_ID;
};

const buildPaymentsByMode = (payments) => {
  const paymentsByMode = {};
  for (const payment of payments) {
    const mode = payment.mode || "OTHER";
    paymentsByMode[mode] = roundCurrency((paymentsByMode[mode] || 0) + Number(payment.amount || 0));
  }
  return paymentsByMode;
};

const buildSiteReportRow = ({ siteKey, siteName, siteCustomers, payments, bills, customerById, totalCollection }) => {
  const customerIds = new Set(siteCustomers.map((c) => c._id.toString()));
  const sitePayments = payments.filter((p) => customerIds.has(p.customerId.toString()));
  const siteBills = bills.filter((b) => customerIds.has(b.customerId.toString()));

  const collection = roundCurrency(sitePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const totalBilled = roundCurrency(siteBills.reduce((sum, b) => sum + Number(b.amount || 0), 0));
  const totalBillPaid = roundCurrency(siteBills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0));
  const totalBillDue = roundCurrency(siteBills.reduce((sum, b) => sum + calculateBillDue(b), 0));

  const paymentRows = sitePayments
    .map((payment) => {
      const customer = customerById.get(payment.customerId.toString());
      return {
        id: payment._id.toString(),
        customerName: customer ? customer.name : "Unknown",
        amount: roundCurrency(payment.amount),
        mode: payment.mode || "OTHER",
        paymentDate: toIsoOrNull(payment.paymentDate)
      };
    })
    .sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0));

  return {
    siteId: siteKey === UNASSIGNED_SITE_ID ? null : siteKey,
    siteName,
    customerCount: siteCustomers.length,
    collection: {
      total: collection,
      transactionCount: sitePayments.length,
      paymentsByMode: buildPaymentsByMode(sitePayments),
      sharePercent: totalCollection > 0 ? roundCurrency((collection / totalCollection) * 100) : 0
    },
    billing: {
      billsCreated: siteBills.length,
      totalBilled,
      totalBillPaid,
      totalBillDue
    },
    payments: paymentRows
  };
};

const buildSiteReports = ({ sites, allCustomers, payments, bills, totalCollection }) => {
  const customersBySite = new Map();

  for (const customer of allCustomers) {
    const key = getCustomerSiteKey(customer);
    if (!customersBySite.has(key)) {
      customersBySite.set(key, []);
    }
    customersBySite.get(key).push(customer);
  }

  const customerById = new Map(allCustomers.map((c) => [c._id.toString(), c]));
  const siteReports = [];

  for (const site of sites) {
    const siteKey = site._id.toString();
    siteReports.push(
      buildSiteReportRow({
        siteKey,
        siteName: site.name,
        siteCustomers: customersBySite.get(siteKey) || [],
        payments,
        bills,
        customerById,
        totalCollection
      })
    );
  }

  const unassignedCustomers = customersBySite.get(UNASSIGNED_SITE_ID) || [];
  const hasUnassignedActivity =
    unassignedCustomers.length > 0 ||
    payments.some((p) => {
      const customer = customerById.get(p.customerId.toString());
      return !customer || !customer.siteId;
    });

  if (hasUnassignedActivity) {
    siteReports.push(
      buildSiteReportRow({
        siteKey: UNASSIGNED_SITE_ID,
        siteName: UNASSIGNED_SITE_NAME,
        siteCustomers: unassignedCustomers,
        payments,
        bills,
        customerById,
        totalCollection
      })
    );
  }

  siteReports.sort((a, b) => b.collection.total - a.collection.total);
  return siteReports;
};

const buildSalesReport = async (monthKey) => {
  const monthStart = dayjs(`${monthKey}-01`).startOf("month");
  const monthEnd = monthStart.endOf("month");

  const [payments, bills, newCustomers, allCustomers, sites, employees, attendanceRecords] = await Promise.all([
    Payment.find({
      paymentDate: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() }
    })
      .sort({ paymentDate: -1 })
      .lean(),
    Bill.find({ monthKey }).lean(),
    Customer.find({
      createdAt: { $gte: monthStart.toDate(), $lte: monthEnd.toDate() }
    }).lean(),
    Customer.find({ isActive: true }).lean(),
    Site.find({ isActive: true }).sort({ isDefault: -1, name: 1 }).lean(),
    Employee.find({ isActive: true }).lean(),
    AttendanceRecord.find({ monthKey }).lean()
  ]);

  const totalCollection = roundCurrency(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const totalBilled = roundCurrency(bills.reduce((sum, b) => sum + Number(b.amount || 0), 0));
  const totalBillPaid = roundCurrency(bills.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0));
  const totalBillDue = roundCurrency(bills.reduce((sum, b) => sum + calculateBillDue(b), 0));

  const paymentsByMode = buildPaymentsByMode(payments);

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

  const siteReports = buildSiteReports({
    sites,
    allCustomers,
    payments,
    bills,
    totalCollection
  });

  const collectionBySite = {};
  for (const row of siteReports) {
    collectionBySite[row.siteName] = row.collection.total;
  }

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
    attendance: {
      employeesTracked: employees.length,
      recordsMarked: attendanceRecords.length,
      present: attendanceRecords.filter((r) => r.status === "PRESENT").length,
      absent: attendanceRecords.filter((r) => r.status === "ABSENT").length,
      halfDay: attendanceRecords.filter((r) => r.status === "HALF_DAY").length,
      leave: attendanceRecords.filter((r) => r.status === "LEAVE").length
    },
    siteReports
  };
};

module.exports = {
  buildSalesReport,
  roundCurrency
};
