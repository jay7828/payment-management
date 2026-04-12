const dayjs = require("dayjs");

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const getCurrentMonthKey = () => dayjs().format("YYYY-MM");

const ensureMonthKey = (monthKey) => {
  if (!MONTH_KEY_REGEX.test(monthKey)) {
    throw new Error("monthKey must be in YYYY-MM format.");
  }
  return monthKey;
};

module.exports = {
  getCurrentMonthKey,
  ensureMonthKey
};
