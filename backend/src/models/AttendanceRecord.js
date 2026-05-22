const mongoose = require("mongoose");

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"];

const attendanceRecordSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      required: true
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

attendanceRecordSchema.index({ employeeId: 1, dateKey: 1 }, { unique: true });
attendanceRecordSchema.index({ monthKey: 1, employeeId: 1 });

module.exports = mongoose.model("AttendanceRecord", attendanceRecordSchema);
module.exports.ATTENDANCE_STATUSES = ATTENDANCE_STATUSES;
