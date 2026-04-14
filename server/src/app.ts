import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import XLSX from "xlsx";
import { z } from "zod";
import { getEnv } from "./env";
import { authMiddleware, requireAuth, signSession, AuthedRequest } from "./auth";
import { getData, clearCache } from "./dataService";
import { normalizeText } from "./normalize";
import { buildSummary } from "./stats";

function createApp() {
const env = getEnv();

const app = express();
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(authMiddleware(env.JWT_SECRET));

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function adminSet(): Set<string> {
  const raw = env.ADMIN_USERNAMES ?? "";
  const configured = new Set(
    raw
      .split(",")
      .map((s) => normalizeText(s))
      .filter(Boolean),
  );
  configured.add(normalizeText("Admin"));
  return configured;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/me", (req: AuthedRequest, res) => {
  res.json({ session: req.session ?? null });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_BODY" });
    return;
  }

  const { username, password } = parsed.data;
  const data = await getData(env);
  const user = data.users.find((u) => u.username === username && u.password === password);
  if (!user) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  const role = adminSet().has(normalizeText(username)) ? "admin" : "guest";

  const token = signSession(
    { username: user.username, role, personName: user.personName },
    env.JWT_SECRET,
  );

  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ session: { username: user.username, role, personName: user.personName } });
});

app.post("/api/auth/logout", (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("session", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
  res.json({ ok: true });
});

function guestKeys(session: { username: string; personName?: string }): string[] {
  return [session.personName, session.username].filter(Boolean).map((s) => normalizeText(s));
}

app.get("/api/data", requireAuth, async (req: AuthedRequest, res) => {
  const session = req.session!;
  const data = await getData(env);

  const visibleTransactions =
    session.role === "admin"
      ? data.transactions
      : data.transactions.filter((tx) => {
          const keys = guestKeys(session);
          if (keys.length === 0) return false;
          const p = normalizeText(tx.person);
          return keys.includes(p);
        });

  const summary = buildSummary(visibleTransactions, data.rules);

  res.json({
    fetchedAt: data.fetchedAt,
    role: session.role,
    rules: data.rules,
    payment: data.payment,
    transactions: visibleTransactions,
    summary,
    users:
      session.role === "admin"
        ? data.users.map((u) => ({ username: u.username, personName: u.personName }))
        : undefined,
  });
});

app.post("/api/admin/refresh", requireAuth, async (req: AuthedRequest, res) => {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  clearCache();
  await getData(env);
  res.json({ ok: true });
});

function buildExportWorkbook(
  transactions: {
    sheet: string;
    bank: string;
    date?: string;
    content: string;
    amount: number;
    person?: string;
    status?: string;
  }[],
  summary: ReturnType<typeof buildSummary>,
  options: { includeBank: boolean },
): Buffer {
  const wb = XLSX.utils.book_new();

  const monthCode = (sheetName: string): string => {
    const m = /(\d{6})\s*$/.exec(sheetName);
    return m?.[1] ?? sheetName;
  };

  const headers = [
    "STT",
    "Tháng",
    ...(options.includeBank ? ["Thẻ"] : []),
    "Ngày",
    "Nội dung",
    "Người đặt",
    "Trạng thái",
    "Số tiền",
  ];

  const rows = transactions.map((tx, idx) => {
    const row: (string | number)[] = [
      idx + 1,
      monthCode(tx.sheet),
      ...(options.includeBank ? [tx.bank] : []),
      tx.date ?? "",
      tx.content,
      tx.person ?? "",
      tx.status ?? "",
      tx.amount,
    ];
    return row;
  });

  const wsTx = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const amountColIndex = headers.indexOf("Số tiền");
  for (let r = 1; r < rows.length + 1; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: amountColIndex });
    const cell = wsTx[addr];
    if (cell) {
      cell.t = "n";
      cell.z = "#,##0";
    }
  }

  const cols = headers.map((h) => {
    switch (h) {
      case "STT":
        return { wch: 6 };
      case "Tháng":
        return { wch: 10 };
      case "Thẻ":
        return { wch: 18 };
      case "Ngày":
        return { wch: 12 };
      case "Nội dung":
        return { wch: 55 };
      case "Người đặt":
        return { wch: 16 };
      case "Trạng thái":
        return { wch: 14 };
      case "Số tiền":
        return { wch: 16 };
      default:
        return { wch: Math.max(12, String(h).length + 2) };
    }
  });
  (wsTx as any)["!cols"] = cols;

  XLSX.utils.book_append_sheet(wb, wsTx, "Giao dịch");

  const wsSummary = XLSX.utils.json_to_sheet([
    { "Chỉ số": "Tổng chi tiêu", "Giá trị": summary.totalSpent },
    { "Chỉ số": "Tổng nợ (Chưa trả)", "Giá trị": summary.totalDebt },
    { "Chỉ số": "Đã trả", "Giá trị": summary.totalPaid },
    { "Chỉ số": "Chưa trả", "Giá trị": summary.totalUnpaid },
    { "Chỉ số": "Số giao dịch", "Giá trị": transactions.length },
  ]);
  for (let r = 1; r <= 4; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 1 });
    const cell = wsSummary[addr];
    if (cell) {
      cell.t = "n";
      cell.z = "#,##0";
    }
  }
  const countAddr = XLSX.utils.encode_cell({ r: 5, c: 1 });
  if (wsSummary[countAddr]) wsSummary[countAddr].z = "0";
  (wsSummary as any)["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng hợp");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as unknown as Buffer;
}

function safeFilePart(value: string): string {
  return value.replace(/[^\w\s.-]/g, "_").trim() || "ALL";
}

app.get("/api/admin/export", requireAuth, async (req: AuthedRequest, res) => {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const bank = typeof req.query.bank === "string" ? req.query.bank : undefined;
  const person = typeof req.query.person === "string" ? req.query.person : undefined;

  const data = await getData(env);
  const filtered = data.transactions.filter((tx) => {
    if (month && tx.sheet !== month) return false;
    if (bank && normalizeText(tx.bank) !== normalizeText(bank)) return false;
    if (person && normalizeText(tx.person) !== normalizeText(person)) return false;
    return true;
  });

  const summary = buildSummary(filtered, data.rules);
  const buffer = buildExportWorkbook(filtered, summary, { includeBank: true });
  const fileName = `chi-tieu_${safeFilePart(month ?? "ALL")}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
});

app.get("/api/export", requireAuth, async (req: AuthedRequest, res) => {
  const session = req.session!;
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const bank = typeof req.query.bank === "string" ? req.query.bank : undefined;
  const person = typeof req.query.person === "string" ? req.query.person : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;

  const data = await getData(env);

  const scopeTransactions =
    session.role === "admin"
      ? data.transactions
      : data.transactions.filter((tx) => {
          const keys = guestKeys(session);
          if (keys.length === 0) return false;
          const p = normalizeText(tx.person);
          return keys.includes(p);
        });

  const qNorm = q ? normalizeText(q) : "";
  const filtered = scopeTransactions.filter((tx) => {
    if (month && tx.sheet !== month) return false;
    if (session.role === "admin" && bank && normalizeText(tx.bank) !== normalizeText(bank)) return false;
    if (session.role === "admin" && person && normalizeText(tx.person) !== normalizeText(person)) return false;
    if (status && String(tx.status ?? "") !== status) return false;
    if (qNorm) {
      const haystack = [
        tx.sheet,
        session.role === "admin" ? tx.bank : "",
        tx.date ?? "",
        tx.content,
        tx.person ?? "",
        tx.status ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      if (!normalizeText(haystack).includes(qNorm)) return false;
    }
    return true;
  });

  const summary = buildSummary(filtered, data.rules);
  const buffer = buildExportWorkbook(filtered, summary, { includeBank: session.role === "admin" });
  const fileName = `chi-tieu_${safeFilePart(month ?? "ALL")}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
});

return app;
}

// Safe export: catch init errors so Vercel returns HTTP 500 instead of FUNCTION_INVOCATION_FAILED
let _app: express.Application | null = null;
let _initError: unknown = null;
try {
  _app = createApp();
} catch (e) {
  _initError = e;
  // eslint-disable-next-line no-console
  console.error("[startup] App initialization failed:", e);
}

const fallback = express();
fallback.use((_req, res) => {
  res.status(500).json({
    error: "Server configuration error",
    details: _initError instanceof Error ? _initError.message : String(_initError),
  });
});

export default (_app ?? fallback) as express.Application;
