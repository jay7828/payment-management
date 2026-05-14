const express = require("express");
const {
  listCustomers,
  createCustomer,
  getCustomerDetails,
  updateCustomer,
  deleteCustomer
} = require("../controllers/customerController");
const { createBill, recordPayment, updateBill, deleteBill, updatePayment, deletePayment } = require("../controllers/billingController");

const router = express.Router();

router.get("/", listCustomers);
router.post("/", createCustomer);
router.get("/:customerId", getCustomerDetails);
router.patch("/:customerId", updateCustomer);
router.delete("/:customerId", deleteCustomer);
router.post("/:customerId/bills", createBill);
router.patch("/:customerId/bills/:billId", updateBill);
router.delete("/:customerId/bills/:billId", deleteBill);
router.post("/:customerId/payments", recordPayment);
router.patch("/:customerId/payments/:paymentId", updatePayment);
router.delete("/:customerId/payments/:paymentId", deletePayment);

module.exports = router;
