const express = require("express");
const {
  listCustomers,
  createCustomer,
  getCustomerDetails,
  updateCustomer
} = require("../controllers/customerController");
const { createBill, recordPayment } = require("../controllers/billingController");

const router = express.Router();

router.get("/", listCustomers);
router.post("/", createCustomer);
router.get("/:customerId", getCustomerDetails);
router.patch("/:customerId", updateCustomer);
router.post("/:customerId/bills", createBill);
router.post("/:customerId/payments", recordPayment);

module.exports = router;
