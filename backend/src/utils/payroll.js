const dayjs = require("dayjs");

const STATUS_WEIGHT = {
  PRESENT: 1,
  LEAVE: 1,
  HALF_DAY: 0.5,
  ABSENT: 0
};

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const summarizeAttendancePay = (records, daysInMonth, monthlySalary) => {
  const counts = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, markedDays: 0 };
  let payableUnits = 0;

  for (const record of records) {
    counts[record.status] += 1;
    counts.markedDays += 1;
    payableUnits += STATUS_WEIGHT[record.status] || 0;
  }

  const dailyRate = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
  const earnedPay = roundCurrency(payableUnits * dailyRate);

  return {
    counts,
    payableUnits: roundCurrency(payableUnits),
    daysInMonth,
    earnedPay
  };
};

const sumAdvances = (advances) =>
  roundCurrency(advances.reduce((sum, row) => sum + Number(row.amount || 0), 0));

const buildSettlement = ({ earnedPay, totalAdvances }) => {
  const netPayable = roundCurrency(earnedPay - totalAdvances);
  return {
    earnedPay: roundCurrency(earnedPay),
    totalAdvances: roundCurrency(totalAdvances),
    netPayable
  };
};

const getMonthBounds = (monthKey) => ({
  monthStart: dayjs(`${monthKey}-01`).startOf("month"),
  monthEnd: dayjs(`${monthKey}-01`).endOf("month"),
  daysInMonth: dayjs(`${monthKey}-01`).daysInMonth()
});

module.exports = {
  STATUS_WEIGHT,
  roundCurrency,
  summarizeAttendancePay,
  sumAdvances,
  buildSettlement,
  getMonthBounds
};
