const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    appliedToBill: {
      type: Number,
      default: 0,
      min: 0
    },
    extraCredit: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    mode: {
      type: String,
      enum: ["CASH", "UPI", "BANK", "OTHER"],
      default: "CASH"
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

module.exports = mongoose.model("Payment", paymentSchema);
