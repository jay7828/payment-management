const dayjs = require("dayjs");
const Employee = require("../models/Employee");
const EmployeeAdvance = require("../models/EmployeeAdvance");
const AttendanceRecord = require("../models/AttendanceRecord");
const { getCurrentMonthKey, ensureMonthKey } = require("../utils/month");
const {
  roundCurrency,
  summarizeAttendancePay,
  sumAdvances,
  buildSettlement,
  getMonthBounds
} = require("../utils/payroll");

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const serializeEmployee = (employee) => ({
  id: employee._id.toString(),
  name: employee.name,
  monthlySalary: roundCurrency(employee.monthlySalary),
  isActive: Boolean(employee.isActive),
  createdAt: toIsoOrNull(employee.createdAt),
  updatedAt: toIsoOrNull(employee.updatedAt)
});

const serializeAdvance = (advance) => ({
  id: advance._id.toString(),
  employeeId: advance.employeeId.toString(),
  amount: roundCurrency(advance.amount),
  advanceDate: toIsoOrNull(advance.advanceDate),
  monthKey: advance.monthKey,
  notes: advance.notes || ""
});

const buildEmployeeCard = (employee, attendanceRecords, advances, monthKey) => {
  const { daysInMonth } = getMonthBounds(monthKey);
  const attendance = summarizeAttendancePay(attendanceRecords, daysInMonth, employee.monthlySalary);
  const totalAdvances = sumAdvances(advances);
  const settlement = buildSettlement({
    earnedPay: attendance.earnedPay,
    totalAdvances
  });

  return {
    ...serializeEmployee(employee),
    monthKey,
    attendance: {
      presentDays: attendance.counts.PRESENT + attendance.counts.LEAVE,
      absentDays: attendance.counts.ABSENT,
      halfDays: attendance.counts.HALF_DAY,
      markedDays: attendance.counts.markedDays
    },
    earnedPay: settlement.earnedPay,
    totalAdvances: settlement.totalAdvances,
    netPayable: settlement.netPayable,
    advanceCount: advances.length
  };
};

const listEmployees = async (req, res, next) => {
  try {
    const monthKey = ensureMonthKey(String(req.query.monthKey || getCurrentMonthKey()));
    const search = String(req.query.search || "").trim();
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    const filter = includeInactive ? {} : { isActive: true };

    if (search) {
      filter.name = new RegExp(search, "i");
    }

    const employees = await Employee.find(filter).sort({ name: 1 }).lean();
    if (!employees.length) {
      return res.json({ monthKey, employees: [] });
    }

    const employeeIds = employees.map((e) => e._id);
    const [attendanceRows, advanceRows] = await Promise.all([
      AttendanceRecord.find({ employeeId: { $in: employeeIds }, monthKey }).lean(),
      EmployeeAdvance.find({ employeeId: { $in: employeeIds }, monthKey }).sort({ advanceDate: -1 }).lean()
    ]);

    const attendanceByEmployee = new Map();
    for (const row of attendanceRows) {
      const key = row.employeeId.toString();
      if (!attendanceByEmployee.has(key)) attendanceByEmployee.set(key, []);
      attendanceByEmployee.get(key).push(row);
    }

    const advancesByEmployee = new Map();
    for (const row of advanceRows) {
      const key = row.employeeId.toString();
      if (!advancesByEmployee.has(key)) advancesByEmployee.set(key, []);
      advancesByEmployee.get(key).push(row);
    }

    const cards = employees.map((employee) => {
      const key = employee._id.toString();
      return buildEmployeeCard(
        employee,
        attendanceByEmployee.get(key) || [],
        advancesByEmployee.get(key) || [],
        monthKey
      );
    });

    return res.json({ monthKey, employees: cards });
  } catch (error) {
    if (error.message && error.message.includes("monthKey")) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

const createEmployee = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const salary = Number(req.body.monthlySalary);

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({ message: "monthlySalary must be a non-negative number" });
    }

    const employee = await Employee.create({
      name,
      monthlySalary: roundCurrency(salary),
      isActive: true
    });

    return res.status(201).json({ employee: serializeEmployee(employee) });
  } catch (error) {
    return next(error);
  }
};

const getEmployeeDetails = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const monthKey = ensureMonthKey(String(req.query.monthKey || getCurrentMonthKey()));

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const [attendanceRecords, advances] = await Promise.all([
      AttendanceRecord.find({ employeeId, monthKey }).sort({ dateKey: -1 }).lean(),
      EmployeeAdvance.find({ employeeId, monthKey }).sort({ advanceDate: -1 }).lean()
    ]);

    const { daysInMonth } = getMonthBounds(monthKey);
    const attendance = summarizeAttendancePay(attendanceRecords, daysInMonth, employee.monthlySalary);
    const totalAdvances = sumAdvances(advances);
    const settlement = buildSettlement({
      earnedPay: attendance.earnedPay,
      totalAdvances
    });

    return res.json({
      monthKey,
      employee: serializeEmployee(employee),
      settlement,
      attendance: {
        counts: attendance.counts,
        payableUnits: attendance.payableUnits,
        daysInMonth: attendance.daysInMonth
      },
      advances: advances.map(serializeAdvance),
      records: attendanceRecords.map((record) => ({
        id: record._id.toString(),
        dateKey: record.dateKey,
        status: record.status,
        notes: record.notes || ""
      }))
    });
  } catch (error) {
    if (error.message && error.message.includes("monthKey")) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

const createAdvance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const amount = Number(req.body.amount);
    const notes = String(req.body.notes || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "amount must be greater than 0" });
    }

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const advanceDate = req.body.advanceDate ? new Date(req.body.advanceDate) : new Date();
    if (Number.isNaN(advanceDate.getTime())) {
      return res.status(400).json({ message: "advanceDate is invalid" });
    }

    const monthKey = ensureMonthKey(String(req.body.monthKey || dayjs(advanceDate).format("YYYY-MM")));

    const advance = await EmployeeAdvance.create({
      employeeId,
      amount: roundCurrency(amount),
      advanceDate,
      monthKey,
      notes
    });

    return res.status(201).json({ advance: serializeAdvance(advance) });
  } catch (error) {
    if (error.message && error.message.includes("monthKey")) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

const deleteAdvance = async (req, res, next) => {
  try {
    const { employeeId, advanceId } = req.params;
    const deleted = await EmployeeAdvance.findOneAndDelete({ _id: advanceId, employeeId });

    if (!deleted) {
      return res.status(404).json({ message: "Advance not found" });
    }

    return res.json({ message: "Advance deleted" });
  } catch (error) {
    return next(error);
  }
};

const updateEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const setUpdates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({ message: "name cannot be empty" });
      }
      setUpdates.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "monthlySalary")) {
      const salary = Number(req.body.monthlySalary);
      if (!Number.isFinite(salary) || salary < 0) {
        return res.status(400).json({ message: "monthlySalary must be a non-negative number" });
      }
      setUpdates.monthlySalary = roundCurrency(salary);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      setUpdates.isActive = Boolean(req.body.isActive);
    }

    if (!Object.keys(setUpdates).length) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    const employee = await Employee.findByIdAndUpdate(employeeId, { $set: setUpdates }, { new: true, runValidators: true }).lean();

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.json({ employee: serializeEmployee(employee) });
  } catch (error) {
    return next(error);
  }
};

const deleteEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId).select("_id").lean();
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    await Promise.all([
      AttendanceRecord.deleteMany({ employeeId }),
      EmployeeAdvance.deleteMany({ employeeId }),
      Employee.deleteOne({ _id: employeeId })
    ]);

    return res.json({ message: "Employee, attendance, and advances deleted" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listEmployees,
  createEmployee,
  getEmployeeDetails,
  createAdvance,
  deleteAdvance,
  updateEmployee,
  deleteEmployee
};
