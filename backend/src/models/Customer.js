const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
      minlength: 7,
      maxlength: 20
    },
    address: {
      type: String,
      trim: true,
      default: ""
    },
    otherInfo: {
      type: String,
      trim: true,
      default: ""
    },
    openingBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    creditBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

customerSchema.index({ mobile: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);
