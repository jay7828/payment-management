const express = require("express");
const {
  getMonthAttendance,
  markAttendance,
  markBulkAttendance,
  deleteAttendance
} = require("../controllers/attendanceController");

const router = express.Router();

router.get("/", getMonthAttendance);
router.post("/", markAttendance);
router.post("/bulk", markBulkAttendance);
router.delete("/:recordId", deleteAttendance);

module.exports = router;
