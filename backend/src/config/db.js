const mongoose = require("mongoose");
const { MONGODB_URI } = require("./env");

const connectDB = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGODB_URI);
  return mongoose.connection;
};

module.exports = connectDB;
