const toNumber = (value) => Number(value || 0);

const calculateBillDue = (bill) => {
  const amount = toNumber(bill.amount);
  const paidAmount = toNumber(bill.paidAmount);
  return Math.max(0, amount - paidAmount);
};

const calculateCustomerTotalDue = (customer, bills = []) => {
  const openingBalance = toNumber(customer.openingBalance);
  const creditBalance = toNumber(customer.creditBalance);
  const billsDue = bills.reduce((sum, bill) => sum + calculateBillDue(bill), 0);

  return Math.max(0, openingBalance + billsDue - creditBalance);
};

module.exports = {
  calculateBillDue,
  calculateCustomerTotalDue
};
