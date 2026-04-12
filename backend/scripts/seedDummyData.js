const dayjs = require("dayjs");
const connectDB = require("../src/config/db");
const Customer = require("../src/models/Customer");
const Bill = require("../src/models/Bill");
const Payment = require("../src/models/Payment");

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const buildMobile = (base, index) => {
  const numeric = String(base + index).slice(-9).padStart(9, "0");
  return `9${numeric}`;
};

const createSeedData = async () => {
  await connectDB();

  const now = dayjs();
  const currentMonthKey = now.format("YYYY-MM");
  const previousMonthKey = now.subtract(1, "month").format("YYYY-MM");
  const base = Number(dayjs().format("HHmmss")) * 100;

  const createdCustomerIds = [];

  for (let index = 1; index <= 15; index += 1) {
    const mobile = buildMobile(base, index);

    const customer = await Customer.create({
      name: `Test Customer ${String(index).padStart(2, "0")}`,
      mobile,
      address: `Sector ${index}, City Zone`,
      otherInfo: "DUMMY_TEST_DATA",
      openingBalance: index % 5 === 0 ? 150 : 0,
      isActive: true
    });

    createdCustomerIds.push(customer._id);

    const previousBillAmount = round(520 + index * 18);
    const currentBillAmount = round(600 + index * 22);

    let previousPaid = 0;
    let currentPaid = 0;

    if (index % 3 === 0) {
      previousPaid = previousBillAmount;
      currentPaid = currentBillAmount;
    } else if (index % 3 === 1) {
      previousPaid = previousBillAmount;
      currentPaid = round(currentBillAmount * 0.55);
    } else {
      previousPaid = round(previousBillAmount * 0.45);
      currentPaid = 0;
    }

    const previousBill = await Bill.create({
      customerId: customer._id,
      monthKey: previousMonthKey,
      billedDate: now.subtract(1, "month").date(5).toDate(),
      amount: previousBillAmount,
      paidAmount: previousPaid,
      lastPaymentDate: previousPaid > 0 ? now.subtract(1, "month").date(18).toDate() : null,
      notes: "Dummy seed previous month"
    });

    const currentBill = await Bill.create({
      customerId: customer._id,
      monthKey: currentMonthKey,
      billedDate: now.date(4).toDate(),
      amount: currentBillAmount,
      paidAmount: currentPaid,
      lastPaymentDate: currentPaid > 0 ? now.date(12).toDate() : null,
      notes: "Dummy seed current month"
    });

    if (previousPaid > 0) {
      await Payment.create({
        customerId: customer._id,
        billId: previousBill._id,
        amount: previousPaid,
        appliedToBill: previousPaid,
        extraCredit: 0,
        paymentDate: now.subtract(1, "month").date(18).toDate(),
        mode: index % 2 === 0 ? "UPI" : "CASH",
        notes: "Dummy previous payment"
      });
    }

    if (currentPaid > 0) {
      await Payment.create({
        customerId: customer._id,
        billId: currentBill._id,
        amount: currentPaid,
        appliedToBill: currentPaid,
        extraCredit: 0,
        paymentDate: now.date(12).toDate(),
        mode: index % 2 === 0 ? "BANK" : "CASH",
        notes: "Dummy current payment"
      });
    }

    if (index % 7 === 0) {
      const extraCredit = 90;
      customer.creditBalance = round(customer.creditBalance + extraCredit);
      await customer.save();

      await Payment.create({
        customerId: customer._id,
        billId: currentBill._id,
        amount: extraCredit,
        appliedToBill: 0,
        extraCredit,
        paymentDate: now.date(13).toDate(),
        mode: "UPI",
        notes: "Dummy advance credit"
      });
    }
  }

  const insertedCount = await Customer.countDocuments({ _id: { $in: createdCustomerIds } });
  console.log(`Inserted ${insertedCount} dummy customers with billing and payment records.`);
  process.exit(0);
};

createSeedData().catch((error) => {
  console.error("Failed to seed dummy data:", error);
  process.exit(1);
});
