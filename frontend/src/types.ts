export interface AdminUser {
  username: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  admin: AdminUser;
}

export type CustomerStatus = "BILLED" | "PAID";

export interface Site {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Employee {
  id: string;
  name: string;
  monthlySalary: number;
  isActive: boolean;
}

export interface EmployeeCardData extends Employee {
  monthKey: string;
  attendance: {
    presentDays: number;
    absentDays: number;
    halfDays: number;
    markedDays: number;
  };
  earnedPay: number;
  totalAdvances: number;
  netPayable: number;
  advanceCount: number;
}

export interface EmployeeAdvance {
  id: string;
  employeeId: string;
  amount: number;
  advanceDate: string | null;
  monthKey: string;
  notes: string;
}

export interface EmployeeSettlement {
  earnedPay: number;
  totalAdvances: number;
  netPayable: number;
}

export interface EmployeeDetailsResponse {
  monthKey: string;
  employee: Employee;
  settlement: EmployeeSettlement;
  attendance: {
    counts: AttendanceSummary["counts"];
    payableUnits: number;
    daysInMonth: number;
  };
  advances: EmployeeAdvance[];
  records: Array<{ id: string; dateKey: string; status: AttendanceStatus; notes: string }>;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  dateKey: string;
  monthKey: string;
  status: AttendanceStatus;
  notes: string;
}

export interface AttendanceSummary {
  counts: {
    PRESENT: number;
    ABSENT: number;
    HALF_DAY: number;
    LEAVE: number;
    markedDays: number;
  };
  payableUnits: number;
  daysInMonth: number;
  estimatedPayout: number;
}

export interface EmployeeAttendanceRow {
  employee: Employee;
  records: AttendanceRecord[];
  summary: AttendanceSummary;
}

export interface SalesReport {
  monthKey: string;
  monthLabel: string;
  generatedAt: string;
  sales: {
    totalCollection: number;
    transactionCount: number;
    paymentsByMode: Record<string, number>;
    collectionBySite: Record<string, number>;
  };
  billing: {
    billsCreated: number;
    totalBilled: number;
    totalBillPaid: number;
    totalBillDue: number;
  };
  customers: {
    newCustomers: number;
    activeCustomers: number;
    totalOutstandingDue: number;
  };
  attendance: {
    employeesTracked: number;
    recordsMarked: number;
    present: number;
    absent: number;
    halfDay: number;
    leave: number;
  };
}

export interface CustomerCardData {
  id: string;
  name: string;
  mobile: string;
  address: string;
  otherInfo: string;
  siteId?: string | null;
  siteName?: string;
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
