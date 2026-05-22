const mongoose = require("mongoose");

const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80
    },
    isDefault: {
      type: Boolean,
      default: false
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

siteSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model("Site", siteSchema);
