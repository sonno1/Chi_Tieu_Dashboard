import https from "node:https";
import { URL } from "node:url";
import XLSX from "xlsx";

export type WorkbookData = {
  workbook: XLSX.WorkBook;
  fetchedAt: number;
};

function fetchWithRedirect(url: string, redirects = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const status = res.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
          if (redirects >= 5) {
            res.resume();
            reject(new Error("Too many redirects"));
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          fetchWithRedirect(next, redirects + 1).then(resolve, reject);
          return;
        }

        if (status !== 200) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

export async function downloadWorkbookXlsx(sheetId: string): Promise<Buffer> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  return fetchWithRedirect(url);
}

export function parseWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer" });
}

export function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];
}

