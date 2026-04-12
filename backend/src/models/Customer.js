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
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value) => !value || value.length >= 7,
        message: "mobile must be at least 7 characters"
      }
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

customerSchema.index(
  { mobile: 1 },
  {
    name: "mobile_1",
    unique: true,
    sparse: true
  }
);

module.exports = mongoose.model("Customer", customerSchema);
