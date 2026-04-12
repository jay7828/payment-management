export interface AdminUser {
  username: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  admin: AdminUser;
}

export type CustomerStatus = "BILLED" | "PAID";

export interface CustomerCardData {
  id: string;
  name: string;
  mobile: string;
  address: string;
  otherInfo: string;
  previousBalance: number;
  openingBalance: number;
  creditBalance: number;
  totalDue: number;
  unpaidBillsCount: number;
  totalUnpaidBillAmount: number;
  currentMonthStatus: CustomerStatus;
  statusDate: string | null;
}

export interface Bill {
  id: string;
  customerId: string;
  monthKey: string;
  billedDate: string | null;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: "BILLED" | "PARTIAL" | "PAID";
  lastPaymentDate: string | null;
  notes: string;
}

export interface Payment {
  id: string;
  customerId: string;
  billId: string | null;
  amount: number;
  appliedToBill: number;
  extraCredit: number;
  paymentDate: string | null;
  mode: "CASH" | "UPI" | "BANK" | "OTHER";
  notes: string;
}

export interface CustomerDetailsResponse {
  customer: CustomerCardData;
  bills: Bill[];
  payments: Payment[];
}

export interface HomeSummary {
  totalCustomers: number;
  customersWithDue: number;
  customersPaid: number;
  totalDue: number;
  currentMonthCollection: number;
  dueCustomers: Array<{
    id: string;
    name: string;
    mobile: string;
    totalDue: number;
    unpaidBillsCount: number;
    totalUnpaidBillAmount: number;
    currentMonthStatus: CustomerStatus;
    statusDate: string | null;
  }>;
}

export interface MonthlyCollectionRow {
  monthKey: string;
  totalCollection: number;
  transactionCount: number;
}
