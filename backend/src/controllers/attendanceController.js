const dayjs = require("dayjs");
const Employee = require("../models/Employee");
const AttendanceRecord = require("../models/AttendanceRecord");
const { ATTENDANCE_STATUSES } = require("../models/AttendanceRecord");
const { ensureMonthKey } = require("../utils/month");

const { roundCurrency, summarizeAttendancePay } = require("../utils/payroll");

const serializeRecord = (record) => ({
  id: record._id.toString(),
  employeeId: record.employeeId.toString(),
  dateKey: record.dateKey,
  monthKey: record.monthKey,
  status: record.status,
  notes: record.notes || ""
});

const parseStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (!ATTENDANCE_STATUSES.includes(normalized)) {
    return null;
  }
  return normalized;
};

const summarizeRecords = (records, daysInMonth, monthlySalary) => {
  const summary = summarizeAttendancePay(records, daysInMonth, monthlySalary);
  return {
    counts: summary.counts,
    payableUnits: summary.payableUnits,
    daysInMonth: summary.daysInMonth,
    estimatedPayout: summary.earnedPay
  };
};

const getMonthAttendance = async (req, res, next) => {
  try {
    const monthKey = ensureMonthKey(String(req.query.monthKey || dayjs().format("YYYY-MM")));
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : null;

    const filter = { monthKey };
    if (employeeId) {
      filter.employeeId = employeeId;
    }

    const [employees, records] = await Promise.all([
      Employee.find(employeeId ? { _id: employeeId } : { isActive: true }).sort({ name: 1 }).lean(),
      AttendanceRecord.find(filter).lean()
    ]);

    const recordsByEmployee = new Map();
    for (const record of records) {
      const key = record.employeeId.toString();
      if (!recordsByEmployee.has(key)) {
        recordsByEmployee.set(key, []);
      }
      recordsByEmployee.get(key).push(record);
    }

    const daysInMonth = dayjs(`${monthKey}-01`).daysInMonth();
    const employeeSummaries = employees.map((employee) => {
      const employeeRecords = recordsByEmployee.get(employee._id.toString()) || [];
      const summary = summarizeRecords(employeeRecords, daysInMonth, employee.monthlySalary);

      return {
        employee: {
          id: employee._id.toString(),
          name: employee.name,
          monthlySalary: roundCurrency(employee.monthlySalary)
        },
        records: employeeRecords.map(serializeRecord),
        summary
      };
    });

    return res.json({
      monthKey,
      daysInMonth,
      employees: employeeSummaries
    });
  } catch (error) {
    if (error.message && error.message.includes("monthKey")) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

const markAttendance = async (req, res, next) => {
  try {
    const employeeId = String(req.body.employeeId || "");
    const dateKey = String(req.body.dateKey || "").trim();
    const status = parseStatus(req.body.status);

    if (!employeeId) {
      return res.status(400).json({ message: "employeeId is required" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ message: "dateKey must be YYYY-MM-DD" });
    }
    if (!status) {
      return res.status(400).json({ message: `status must be one of: ${ATTENDANCE_STATUSES.join(", ")}` });
    }

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const monthKey = dayjs(dateKey).format("YYYY-MM");
    const notes = String(req.body.notes || "").trim();

    const record = await AttendanceRecord.findOneAndUpdate(
      { employeeId, dateKey },
      {
        $set: {
          monthKey,
          status,
          notes
        }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    return res.json({ record: serializeRecord(record) });
  } catch (error) {
    return next(error);
  }
};

const markBulkAttendance = async (req, res, next) => {
  try {
    const dateKey = String(req.body.dateKey || "").trim();
    const status = parseStatus(req.body.status);
    const employeeIds = Array.isArray(req.body.employeeIds) ? req.body.employeeIds.map(String) : [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ message: "dateKey must be YYYY-MM-DD" });
    }
    if (!status) {
      return res.status(400).json({ message: `status must be one of: ${ATTENDANCE_STATUSES.join(", ")}` });
    }
    if (!employeeIds.length) {
      return res.status(400).json({ message: "employeeIds array is required" });
    }

    const employees = await Employee.find({ _id: { $in: employeeIds }, isActive: true }).lean();
    if (!employees.length) {
      return res.status(404).json({ message: "No active employees found for provided IDs" });
    }

    const monthKey = dayjs(dateKey).format("YYYY-MM");
    const notes = String(req.body.notes || "").trim();

    const operations = employees.map((employee) => ({
      updateOne: {
        filter: { employeeId: employee._id, dateKey },
        update: {
          $set: {
            monthKey,
            status,
            notes
          }
        },
        upsert: true
      }
    }));

    await AttendanceRecord.bulkWrite(operations);

    const records = await AttendanceRecord.find({
      employeeId: { $in: employees.map((e) => e._id) },
      dateKey
    }).lean();

    return res.json({
      dateKey,
      status,
      markedCount: records.length,
      records: records.map(serializeRecord)
    });
  } catch (error) {
    return next(error);
  }
};

const deleteAttendance = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const deleted = await AttendanceRecord.findByIdAndDelete(recordId);

    if (!deleted) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    return res.json({ message: "Attendance record deleted" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMonthAttendance,
  markAttendance,
  markBulkAttendance,
  deleteAttendance,
  ATTENDANCE_STATUSES
};
