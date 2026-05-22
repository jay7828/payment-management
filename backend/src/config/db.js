const mongoose = require("mongoose");
const { MONGODB_URI } = require("./env");
const { ensureDefaultSite } = require("../utils/defaultSite");

const MOBILE_INDEX_NAME = "mobile_1";
const MOBILE_INDEX_SPEC = { mobile: 1 };
const MOBILE_INDEX_OPTIONS = {
  name: MOBILE_INDEX_NAME,
  unique: true,
  sparse: true
};

const hasExpectedMobileIndex = (index) => {
  return Boolean(index && index.unique === true && index.sparse === true);
};

const normalizeCustomerMobileValues = async (collection) => {
  await collection.updateMany(
    {
      mobile: {
        $in: ["", null]
      }
    },
    {
      $unset: {
        mobile: ""
      }
    }
  );
};

const ensureCustomerMobileIndex = async () => {
  const collection = mongoose.connection.collection("customers");
  let indexes = [];

  try {
    indexes = await collection.indexes();
  } catch (error) {
    if (!(error && (error.codeName === "NamespaceNotFound" || error.code === 26))) {
      throw error;
    }
  }

  const currentMobileIndex = indexes.find((index) => index.name === MOBILE_INDEX_NAME);

  if (currentMobileIndex && !hasExpectedMobileIndex(currentMobileIndex)) {
    await collection.dropIndex(MOBILE_INDEX_NAME);
  }

  await normalizeCustomerMobileValues(collection);
  await collection.createIndex(MOBILE_INDEX_SPEC, MOBILE_INDEX_OPTIONS);
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGODB_URI);
  await ensureCustomerMobileIndex();
  await ensureDefaultSite();
  return mongoose.connection;
};

module.exports = connectDB;
