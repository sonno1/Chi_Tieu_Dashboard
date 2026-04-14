import XLSX from "xlsx";
import { normalizeText } from "./normalize";
import { CategoryRule, PaymentInfo, SheetUser, Transaction } from "./types";
import { sheetToRows } from "./workbook";

const LOGIN_SHEET_NAME = "Trạng thái đặt hộ";
const CATEGORY_SHEET_NAME = "Danh mục";

function parseMoney(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const text = String(input ?? "").trim();
  if (!text) return 0;
  const normalized = text.replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function excelDateToISO(excelDate: number): string {
  // Excel serial date (days since 1899-12-30)
  const millis = Math.round((excelDate - 25569) * 86400 * 1000);
  return new Date(millis).toISOString().slice(0, 10);
}

function parseDate(input: unknown): string | undefined {
  if (input === null || input === undefined || input === "") return undefined;
  if (typeof input === "number" && Number.isFinite(input)) {
    if (input > 30000) return excelDateToISO(input);
    return String(input);
  }
  const text = String(input).trim();
  return text ? text : undefined;
}

export function extractUsers(workbook: XLSX.WorkBook): SheetUser[] {
  const rows = sheetToRows(workbook, LOGIN_SHEET_NAME);
  const users: SheetUser[] = [];

  for (const row of rows) {
    const username = String(row[5] ?? "").trim(); // Column F
    const password = String(row[6] ?? "").trim(); // Column G
    const personName = String(row[2] ?? "").trim(); // Column C (tên người)
    if (!username || !password) continue;
    users.push({ username, password, personName: personName || undefined });
  }

  return users;
}

export function extractCategoryRules(workbook: XLSX.WorkBook): CategoryRule[] {
  const rows = sheetToRows(workbook, CATEGORY_SHEET_NAME);
  const rowsFallback = rows.length > 0 ? rows : sheetToRows(workbook, "test");
  const rules: CategoryRule[] = [];

  for (const row of rowsFallback) {
    // In sheet `Danh mục`, use column A.
    const maybeCategory = String(row[0] ?? "").trim();
    if (!maybeCategory) continue;
    const match = /(.*?)(?:\((.*)\))?$/.exec(maybeCategory);
    if (!match) continue;
    const category = match[1]?.trim();
    if (!category || normalizeText(category) === "danh muc") continue;
    const rawKeywords = (match[2] ?? "").trim();
    const keywords = rawKeywords
      ? rawKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];

    rules.push({ category, keywords });
  }

  // De-dup by category (keep the first)
  const seen = new Set<string>();
  return rules.filter((r) => {
    const key = normalizeText(r.category);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tryExtractUrlFromFormula(text: string): string | undefined {
  // Common forms from Google Sheets exports:
  // =IMAGE("https://...")
  // =HYPERLINK("https://...","label")
  const m = /"(https?:\/\/[^"]+)"/.exec(text);
  if (!m) return undefined;
  return m[1];
}

function looksLikeUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

export function extractPaymentInfo(workbook: XLSX.WorkBook): PaymentInfo {
  const rows = sheetToRows(workbook, CATEGORY_SHEET_NAME);
  const rowsFallback = rows.length > 0 ? rows : sheetToRows(workbook, "test");

  for (let r = 0; r < Math.min(rowsFallback.length, 30); r++) {
    const row = rowsFallback[r] ?? [];
    for (let c = 0; c < Math.min(row.length, 10); c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      const n = normalizeText(cell);

      // Label-based: [Mã QR] in column A, URL next column
      if (n === "ma qr" || n === "qr" || n === "qrcode" || n === "ma qrcode") {
        const next = String(row[c + 1] ?? "").trim();
        if (looksLikeUrl(next)) return { qr: next };
        if (next.startsWith("=")) {
          const url = tryExtractUrlFromFormula(next);
          if (url) return { qr: url };
        }
      }

      // Formula-based cell itself
      if (cell.startsWith("=")) {
        const url = tryExtractUrlFromFormula(cell);
        if (url) return { qr: url };
      }

      // Direct URL in cell
      if (looksLikeUrl(cell) && n.includes("qr")) return { qr: cell };
    }
  }

  return {};
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i] ?? [];
    const normalized = row.map((c) => normalizeText(c));
    const sttIndex = normalized.findIndex((c) => c === "stt");
    if (sttIndex === -1) continue;
    if (
      normalized[sttIndex + 1] === "ngay" &&
      normalized[sttIndex + 2] === "noi dung chi tieu" &&
      normalized[sttIndex + 3] === "so tien"
    ) {
      return i;
    }
  }
  return -1;
}

function findBlockStarts(headerRow: unknown[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < headerRow.length; i++) {
    if (normalizeText(headerRow[i]) === "stt") starts.push(i);
  }
  return starts;
}

function findBankName(rowsAbove: unknown[][], blockStart: number): string {
  for (let i = rowsAbove.length - 1; i >= 0; i--) {
    const v = rowsAbove[i]?.[blockStart];
    const text = String(v ?? "").trim();
    if (!text) continue;
    // Prefer cells that look like "Thẻ XXX"
    if (normalizeText(text).startsWith("the ")) return text;
    return text;
  }
  return `Thẻ ${blockStart}`;
}

export function extractTransactions(workbook: XLSX.WorkBook): Transaction[] {
  const out: Transaction[] = [];

  const sheetNames = workbook.SheetNames.filter((n) => normalizeText(n).startsWith("sao ke"));
  for (const sheetName of sheetNames) {
    const rows = sheetToRows(workbook, sheetName);
    if (rows.length === 0) continue;

    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex === -1) continue;

    const headerRow = rows[headerRowIndex] ?? [];
    const blockStarts = findBlockStarts(headerRow);
    if (blockStarts.length === 0) continue;

    const rowsAbove = rows.slice(0, headerRowIndex);
    const bankByStart = new Map<number, string>();
    for (const start of blockStarts) bankByStart.set(start, findBankName(rowsAbove, start));

    const dataRows = rows.slice(headerRowIndex + 1);
    for (const row of dataRows) {
      for (const start of blockStarts) {
        const sttRaw = row[start];
        const dateRaw = row[start + 1];
        const contentRaw = row[start + 2];
        const amountRaw = row[start + 3];
        const personRaw = row[start + 4];
        const statusRaw = row[start + 5];

        const content = String(contentRaw ?? "").trim();
        const amount = parseMoney(amountRaw);
        const person = String(personRaw ?? "").trim();
        const status = String(statusRaw ?? "").trim();

        const isEmpty =
          !String(sttRaw ?? "").trim() &&
          !String(dateRaw ?? "").trim() &&
          !content &&
          !String(amountRaw ?? "").trim() &&
          !person &&
          !status;
        if (isEmpty) continue;

        if (!content && amount === 0) continue;

        const sttNum = typeof sttRaw === "number" ? sttRaw : parseInt(String(sttRaw ?? ""), 10);
        const stt = Number.isFinite(sttNum) ? sttNum : undefined;

        out.push({
          sheet: sheetName,
          bank: bankByStart.get(start) ?? "Thẻ",
          stt,
          date: parseDate(dateRaw),
          content,
          amount,
          person: person || undefined,
          status: status || undefined,
        });
      }
    }
  }

  return out;
}
