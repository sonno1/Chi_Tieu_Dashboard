export type UserRole = "admin" | "guest";

export type SheetUser = {
  username: string;
  password: string;
  personName?: string;
};

export type CategoryRule = {
  category: string;
  keywords: string[];
};

export type TransactionStatus = "Đã trả" | "Chưa trả" | string;

export type Transaction = {
  sheet: string;
  bank: string;
  stt?: number;
  date?: string;
  content: string;
  amount: number;
  person?: string;
  status?: TransactionStatus;
};

export type PersonTotals = {
  total: number;
  paid: number;
  unpaid: number;
};

export type Summary = {
  totalSpent: number;
  totalDebt: number;
  totalPaid: number;
  totalUnpaid: number;
  totalByBank: Record<string, number>;
  totalByPerson: Record<string, PersonTotals>;
  totalByCategory: Record<string, number>;
};

export type PaymentInfo = {
  qr?: string;
};
