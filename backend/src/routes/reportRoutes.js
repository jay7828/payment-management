const express = require("express");
const {
  getHomeSummary,
  getMonthlyCollections,
  getSalesReport,
  sendSalesReport
} = require("../controllers/reportController");

const router = express.Router();

router.get("/home-summary", getHomeSummary);
router.get("/monthly-collections", getMonthlyCollections);
router.get("/sales-report", getSalesReport);
router.post("/sales-report/send", sendSalesReport);

module.exports = router;
