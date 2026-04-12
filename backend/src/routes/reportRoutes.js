const express = require("express");
const { getHomeSummary, getMonthlyCollections } = require("../controllers/reportController");

const router = express.Router();

router.get("/home-summary", getHomeSummary);
router.get("/monthly-collections", getMonthlyCollections);

module.exports = router;
