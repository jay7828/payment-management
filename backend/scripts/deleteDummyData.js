const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Customer = require("../src/models/Customer");
const Bill = require("../src/models/Bill");
const Payment = require("../src/models/Payment");

const DUMMY_CUSTOMER_FILTER = { otherInfo: "DUMMY_TEST_DATA" };
const DUMMY_NOTES_REGEX = /^Dummy\s/i;

const deleteDummyData = async () => {
  await connectDB();

  const dummyCustomers = await Customer.find(DUMMY_CUSTOMER_FILTER).select("_id").lean();
  const dummyCustomerIds = dummyCustomers.map((customer) => customer._id);

  const customerLinkedFilter = dummyCustomerIds.length
    ? { customerId: { $in: dummyCustomerIds } }
    : null;

  const paymentDeleteFilter = customerLinkedFilter
    ? {
        $or: [customerLinkedFilter, { notes: DUMMY_NOTES_REGEX }]
      }
    : { notes: DUMMY_NOTES_REGEX };

  const billDeleteFilter = customerLinkedFilter
    ? {
        $or: [customerLinkedFilter, { notes: DUMMY_NOTES_REGEX }]
      }
    : { notes: DUMMY_NOTES_REGEX };

  const deletedPayments = await Payment.deleteMany(paymentDeleteFilter);
  const deletedBills = await Bill.deleteMany(billDeleteFilter);
  const deletedCustomers = await Customer.deleteMany(DUMMY_CUSTOMER_FILTER);

  console.log(
    [
      "Dummy data cleanup complete.",
      `Deleted customers: ${deletedCustomers.deletedCount || 0}`,
      `Deleted bills: ${deletedBills.deletedCount || 0}`,
      `Deleted payments: ${deletedPayments.deletedCount || 0}`
    ].join("\n")
  );
};

deleteDummyData()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Failed to delete dummy data:", error);

    try {
      await mongoose.connection.close();
    } catch (_closeError) {
      // Ignore close failures so the original error can be returned.
    }

    process.exit(1);
  });