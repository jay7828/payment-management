const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true
    },
    monthKey: {
      type: String,
      required: true,
      trim: true
    },
    billedDate: {
      type: Date,
      default: Date.now
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["BILLED", "PARTIAL", "PAID"],
      default: "BILLED"
    },
    lastPaymentDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

billSchema.index({ customerId: 1, monthKey: 1 }, { unique: true });

billSchema.virtual("dueAmount").get(function dueAmountVirtual() {
  return Math.max(0, Number(this.amount || 0) - Number(this.paidAmount || 0));
});

billSchema.pre("validate", function updateBillStatus(next) {
  const dueAmount = Math.max(0, Number(this.amount || 0) - Number(this.paidAmount || 0));

  if (dueAmount === 0) {
    this.status = "PAID";
  } else if (Number(this.paidAmount || 0) > 0) {
    this.status = "PARTIAL";
  } else {
    this.status = "BILLED";
  }

  next();
});

module.exports = mongoose.model("Bill", billSchema);
