const mongoose = require("mongoose");

const employeeAdvanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    advanceDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/
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

employeeAdvanceSchema.index({ employeeId: 1, monthKey: 1, advanceDate: -1 });

module.exports = mongoose.model("EmployeeAdvance", employeeAdvanceSchema);
