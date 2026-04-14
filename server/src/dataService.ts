import XLSX from "xlsx";
import { Env } from "./env";
import { extractCategoryRules, extractPaymentInfo, extractTransactions, extractUsers } from "./extract";
import { CategoryRule, PaymentInfo, SheetUser, Transaction } from "./types";
import { downloadWorkbookXlsx, parseWorkbook } from "./workbook";
import { extractQrImageDataUrlFromXlsx } from "./qrImage";

type Cache = {
  fetchedAt: number;
  workbook: XLSX.WorkBook;
  users: SheetUser[];
  rules: CategoryRule[];
  transactions: Transaction[];
  payment: PaymentInfo;
};

let cache: Cache | null = null;

export async function getData(env: Env): Promise<Cache> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < env.CACHE_TTL_MS) return cache;

  const buffer = await downloadWorkbookXlsx(env.SHEET_ID);
  const workbook = parseWorkbook(buffer);

  const users = extractUsers(workbook);
  const rules = extractCategoryRules(workbook);
  const transactions = extractTransactions(workbook);
  const paymentFromCells = extractPaymentInfo(workbook);
  const qrImage = await extractQrImageDataUrlFromXlsx(buffer, "Danh mục");
  const payment: PaymentInfo = { ...paymentFromCells, qr: qrImage ?? paymentFromCells.qr };

  cache = { fetchedAt: now, workbook, users, rules, transactions, payment };
  return cache;
}

export function clearCache() {
  cache = null;
}
