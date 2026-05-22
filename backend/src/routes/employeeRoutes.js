const express = require("express");
const {
  listEmployees,
  createEmployee,
  getEmployeeDetails,
  createAdvance,
  deleteAdvance,
  updateEmployee,
  deleteEmployee
} = require("../controllers/employeeController");

const router = express.Router();

router.get("/", listEmployees);
router.post("/", createEmployee);
router.get("/:employeeId", getEmployeeDetails);
router.post("/:employeeId/advances", createAdvance);
router.delete("/:employeeId/advances/:advanceId", deleteAdvance);
router.patch("/:employeeId", updateEmployee);
router.delete("/:employeeId", deleteEmployee);

module.exports = router;
