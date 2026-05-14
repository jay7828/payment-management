const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Customer = require("../src/models/Customer");
const Bill = require("../src/models/Bill");
const Payment = require("../src/models/Payment");

if (process.env.CONFIRM_DB_WIPE !== "DELETE_ALL_DATA") {
  console.error(
    "Refusing to wipe the database. Run with:\n  CONFIRM_DB_WIPE=DELETE_ALL_DATA npm run db:wipe"
  );
  process.exit(1);
}

const wipeAll = async () => {
  await connectDB();

  const deletedPayments = await Payment.deleteMany({});
  const deletedBills = await Bill.deleteMany({});
  const deletedCustomers = await Customer.deleteMany({});

  console.log(
    [
      "Full database wipe complete.",
      `Deleted customers: ${deletedCustomers.deletedCount || 0}`,
      `Deleted bills: ${deletedBills.deletedCount || 0}`,
      `Deleted payments: ${deletedPayments.deletedCount || 0}`
    ].join("\n")
  );
};

wipeAll()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Failed to wipe database:", error);

    try {
      await mongoose.connection.close();
    } catch (_closeError) {
      // Ignore close failures so the original error can be returned.
    }

    process.exit(1);
  });
