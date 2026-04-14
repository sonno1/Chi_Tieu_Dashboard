import { useEffect, useMemo, useState } from "react";
import type { CategoryRule, Summary, Transaction } from "../api";
import { adminRefresh, getData } from "../api";
import { formatVnd } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import { normalizeText } from "../lib/normalize";

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function KeyValueTable({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = useMemo(
    () => Object.entries(data).sort((a, b) => b[1] - a[1]),
    [data],
  );

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">Tên</th>
              <th className="py-2 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-t">
                <td className="py-2 pr-4">{k}</td>
                <td className="py-2 text-right font-medium">{formatVnd(v)}</td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td className="py-3 text-sm text-slate-500" colSpan={2}>
                  Không có dữ liệu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PersonTable({ title, totals }: { title: string; totals: Summary["totalByPerson"] }) {
  const rows = useMemo(
    () => Object.entries(totals).sort((a, b) => b[1].total - a[1].total),
    [totals],
  );
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">Người đặt</th>
              <th className="py-2 text-right">Tổng</th>
              <th className="py-2 text-right">Đã trả</th>
              <th className="py-2 text-right">Chưa trả</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, v]) => (
              <tr key={name} className="border-t">
                <td className="py-2 pr-4">{name}</td>
                <td className="py-2 text-right font-medium">{formatVnd(v.total)}</td>
                <td className="py-2 text-right">{formatVnd(v.paid)}</td>
                <td className="py-2 text-right text-amber-700">{formatVnd(v.unpaid)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 text-sm text-slate-500" colSpan={4}>
                  Không có dữ liệu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransactionsTable({
  rows,
  showBank,
  exportBase,
}: {
  rows: Transaction[];
  showBank: boolean;
  exportBase: { month?: string; bank?: string; person?: string };
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.status).filter(Boolean) as string[])).sort(),
    [rows],
  );

  async function exportExcel() {
    const params = new URLSearchParams();
    if (exportBase.month) params.set("month", exportBase.month);
    if (exportBase.bank) params.set("bank", exportBase.bank);
    if (exportBase.person) params.set("person", exportBase.person);
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    // month/bank/person are applied at parent (rows are already scoped); server still re-checks auth scope.
    const res = await fetch(`/api/export?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chi-tieu_${exportBase.month ? exportBase.month.replace(/[^\w\s.-]/g, "_") : "ALL"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && (r.status ?? "") !== status) return false;
      if (!query) return true;
      return (
        (r.content ?? "").toLowerCase().includes(query) ||
        (r.person ?? "").toLowerCase().includes(query) ||
        (r.sheet ?? "").toLowerCase().includes(query)
      );
    });
  }, [rows, q, status]);

  function formatMonthLabel(sheet: string): string {
    const m = /(\d{6})\s*$/.exec(sheet);
    return m?.[1] ?? sheet;
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Danh sách giao dịch</div>
          <div className="text-xs text-slate-500">{filtered.length} dòng</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void exportExcel()}
            className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Xuất Excel
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56 rounded-md border px-3 py-2 text-sm"
            placeholder="Tìm kiếm nội dung/người/tháng..."
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2">STT</th>
              <th className="py-2">Tháng</th>
              {showBank ? <th className="py-2">Thẻ</th> : null}
              <th className="py-2">Ngày</th>
              <th className="py-2">Nội dung</th>
              <th className="py-2">Người đặt</th>
              <th className="py-2">Trạng thái</th>
              <th className="py-2 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={`${r.sheet}-${r.bank}-${r.stt ?? idx}`} className="border-t">
                <td className="py-2 pr-4 text-slate-500">{idx + 1}</td>
                <td className="py-2 pr-4">{formatMonthLabel(r.sheet)}</td>
                {showBank ? <td className="py-2 pr-4">{r.bank}</td> : null}
                <td className="py-2 pr-4">{r.date ?? ""}</td>
                <td className="py-2 pr-4">{r.content}</td>
                <td className="py-2 pr-4">{r.person ?? ""}</td>
                <td className="py-2 pr-4">{r.status ?? ""}</td>
                <td className="py-2 text-right font-medium">{formatVnd(r.amount)}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="py-3 text-sm text-slate-500" colSpan={showBank ? 8 : 7}>
                  Không có dữ liệu phù hợp.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function matchesStatus(status: string | undefined, expected: "paid" | "unpaid"): boolean {
  const s = normalizeText(status);
  if (!s) return false;
  if (expected === "paid") return s.includes("da tra");
  return s.includes("chua tra");
}

function categorize(content: string, rules: CategoryRule[]): string {
  const haystack = normalizeText(content);
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const k = normalizeText(keyword);
      if (!k) continue;
      if (haystack.includes(k)) return rule.category;
    }
  }
  return "Khác";
}

function buildSummaryClient(transactions: Transaction[], rules: CategoryRule[]): Summary {
  const totalByBank: Record<string, number> = {};
  const totalByPerson: Summary["totalByPerson"] = {};
  const totalByCategory: Record<string, number> = {};

  let totalSpent = 0;
  let totalDebt = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;

  for (const tx of transactions) {
    totalSpent += tx.amount;

    const bankKey = tx.bank || "Thẻ";
    totalByBank[bankKey] = (totalByBank[bankKey] ?? 0) + tx.amount;

    if (tx.person) {
      const personKey = tx.person;
      const current = totalByPerson[personKey] ?? { total: 0, paid: 0, unpaid: 0 };
      current.total += tx.amount;
      if (matchesStatus(tx.status, "paid")) current.paid += tx.amount;
      if (matchesStatus(tx.status, "unpaid")) current.unpaid += tx.amount;
      totalByPerson[personKey] = current;

      if (matchesStatus(tx.status, "paid")) totalPaid += tx.amount;
      if (matchesStatus(tx.status, "unpaid")) totalUnpaid += tx.amount;
      if (matchesStatus(tx.status, "unpaid")) totalDebt += tx.amount;
    }

    const category = categorize(tx.content, rules);
    totalByCategory[category] = (totalByCategory[category] ?? 0) + tx.amount;
  }

  return { totalSpent, totalDebt, totalPaid, totalUnpaid, totalByBank, totalByPerson, totalByCategory };
}

export function DashboardPage() {
  const { state } = useAuth();
  const isAuthed = state.status === "authed";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [role, setRole] = useState<"admin" | "guest">("guest");
  const [month, setMonth] = useState<string>("");
  const [autoMonth, setAutoMonth] = useState(true);
  const [bank, setBank] = useState<string>("");
  const [person, setPerson] = useState<string>("");
  const [paymentQr, setPaymentQr] = useState<string | undefined>(undefined);
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getData();
      setRole(res.role);
      setTransactions(res.transactions);
      setRules(res.rules);
      setPaymentQr(res.payment?.qr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    void load();
  }, [isAuthed]);

  useEffect(() => {
    if (role === "guest") {
      setBank("");
      setPerson("");
    }
  }, [role]);

  const months = useMemo(() => Array.from(new Set(transactions.map((t) => t.sheet))).sort(), [transactions]);
  const monthLabels = useMemo(() => {
    return months.map((m) => ({ value: m, label: sheetMonthCode(m) ?? m }));
  }, [months]);

  function sheetMonthCode(sheetName: string): string | undefined {
    const m = /(\d{6})\s*$/.exec(sheetName);
    return m?.[1];
  }

  const defaultMonth = useMemo(() => {
    if (months.length === 0) return undefined;
    const withCodes = months
      .map((m) => ({ name: m, code: sheetMonthCode(m) }))
      .filter((x): x is { name: string; code: string } => Boolean(x.code));
    if (withCodes.length === 0) return months[months.length - 1];
    withCodes.sort((a, b) => Number(a.code) - Number(b.code));
    return withCodes[withCodes.length - 1].name;
  }, [months]);

  useEffect(() => {
    if (!autoMonth) return;
    if (!defaultMonth) return;
    setMonth(defaultMonth);
    setAutoMonth(false);
  }, [defaultMonth, autoMonth]);
  const banksForSelectedMonth = useMemo(() => {
    const rows = month ? transactions.filter((t) => t.sheet === month) : transactions;
    return Array.from(new Set(rows.map((t) => t.bank))).sort();
  }, [transactions, month]);

  const peopleForSelection = useMemo(() => {
    const rows = transactions.filter((t) => {
      if (month && t.sheet !== month) return false;
      if (bank && t.bank !== bank) return false;
      return Boolean((t.person ?? "").trim());
    });
    return Array.from(new Set(rows.map((t) => t.person!).filter(Boolean))).sort();
  }, [transactions, month, bank]);

  const baseFiltered = useMemo(() => {
    return transactions.filter((t) => {
      if (month && t.sheet !== month) return false;
      if (role === "admin" && bank && t.bank !== bank) return false;
      if (role === "admin" && person && normalizeText(t.person) !== normalizeText(person)) return false;
      return true;
    });
  }, [transactions, month, bank, person, role]);

  const summary = useMemo(() => buildSummaryClient(baseFiltered, rules), [baseFiltered, rules]);
  const currentSession = state.status === "authed" ? state.session : null;

  const guestMonthCode = useMemo(() => {
    if (!month) return "";
    const m = /(\d{6})\s*$/.exec(month);
    if (m) return m[1];
    const n = month.replace(/sao\s*ke/i, "").replace(/thang/i, "").trim();
    return n;
  }, [month]);

  const guestPaymentContent = useMemo(() => {
    if (!month) return "";
    if (!currentSession) return "";
    return `${currentSession.username} thanh toán tiền đặt hộ tháng ${guestMonthCode}`;
  }, [month, currentSession, guestMonthCode]);

  if (!isAuthed) return null;

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  const guestAmountToPay = summary.totalUnpaid;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {role === "admin" ? "Bảng điều khiển (Admin)" : "Bảng điều khiển (Guest)"}
          </h1>
          <div className="text-sm text-slate-600">{currentSession?.personName ?? ""}</div>
        </div>
        <div className="flex items-center gap-2">
          {role === "admin" ? (
            <button
              onClick={async () => {
                await adminRefresh();
                await load();
              }}
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Refresh sheet
            </button>
          ) : null}
          <button
            onClick={() => void load()}
            className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Tải lại
          </button>
        </div>
      </div>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <div className="text-xs font-medium text-slate-600">Tháng (sheet)</div>
          <select
            value={month}
            onChange={(e) => {
              const nextMonth = e.target.value;
              setMonth(nextMonth);
              setAutoMonth(false);
              // Reset bank if not available in new month
              const nextBanks = new Set(
                (nextMonth ? transactions.filter((t) => t.sheet === nextMonth) : transactions).map((t) => t.bank),
              );
              if (bank && !nextBanks.has(bank)) setBank("");
              if (person) setPerson("");
            }}
            className="mt-1 rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">Tất cả</option>
            {monthLabels.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {role === "admin" ? (
          <>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Loại thẻ (trong tháng)</div>
              <select
                value={bank}
                onChange={(e) => {
                  setBank(e.target.value);
                  setPerson("");
                }}
                className="mt-1 rounded-md border bg-white px-3 py-2 text-sm"
              >
                <option value="">Tất cả</option>
                {banksForSelectedMonth.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-slate-600">Người đặt hộ</div>
              <select
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="mt-1 rounded-md border bg-white px-3 py-2 text-sm"
              >
                <option value="">Tất cả</option>
                {peopleForSelection.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={async () => {
                const params = new URLSearchParams();
                if (month) params.set("month", month);
                if (bank) params.set("bank", bank);
                if (person) params.set("person", person);
                const res = await fetch(`/api/admin/export?${params.toString()}`, {
                  method: "GET",
                  credentials: "include",
                });
                if (!res.ok) throw new Error(await res.text());
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `chi-tieu_${month || "ALL"}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="h-10 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Xuất Excel
            </button>
            <div className="pb-0.5 text-xs text-slate-500">
              Đang lọc: {month ? month : "Tất cả tháng"} / {bank ? bank : "Tất cả thẻ"} /{" "}
              {person ? person : "Tất cả người"}
            </div>
          </>
        ) : (
          <div className="pb-0.5 text-xs text-slate-500">Đang lọc: {month ? month : "Tất cả tháng"}</div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600 shadow-sm">Đang tải...</div>
      ) : (
        <>
          {role === "admin" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard title="Tổng chi tiêu" value={formatVnd(summary.totalSpent)} />
              <StatCard title="Tổng nợ (Chưa trả)" value={formatVnd(summary.totalDebt)} />
              <StatCard title="Đã trả" value={formatVnd(summary.totalPaid)} />
              <StatCard title="Chưa trả" value={formatVnd(summary.totalUnpaid)} />
              <StatCard title="Số giao dịch" value={String(baseFiltered.length)} />
              <StatCard title="Thẻ (ngân hàng)" value={String(Object.keys(summary.totalByBank).length)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Tổng chi tiêu" value={formatVnd(summary.totalSpent)} />
              <StatCard title="Đã trả" value={formatVnd(summary.totalPaid)} />
              <StatCard title="Chưa trả" value={formatVnd(summary.totalUnpaid)} />
              <StatCard title="Số giao dịch" value={String(baseFiltered.length)} />
            </div>
          )}

          {role === "guest" ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Thông tin thanh toán</div>
                  <div className="text-xs text-slate-500">Dùng QR để quét trong app ngân hàng.</div>
                </div>
                <div className="text-sm font-semibold text-amber-700">{formatVnd(guestAmountToPay)}</div>
              </div>

              {!month ? (
                <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  Chọn 1 tháng (sheet) để tạo nội dung chuyển khoản.
                </div>
              ) : (
                <div className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[360px_1fr] md:items-start">
                    <div className="mx-auto w-full max-w-[360px] rounded-xl border bg-white p-3 shadow-sm md:mx-0">
                      {paymentQr ? (
                        <img src={paymentQr} alt="QR" className="w-full rounded-lg bg-white" />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
                          Chưa có QR
                        </div>
                      )}
                    </div>

                    <div className="md:max-h-[360px] md:overflow-hidden">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setShowPaymentDetails((v) => !v)}
                          className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          {showPaymentDetails ? "Ẩn chi tiết" : "Hiện chi tiết"}
                        </button>
                      </div>

                      {showPaymentDetails ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 md:max-h-[316px] md:overflow-auto md:pr-1">
                          <PayRow
                            label="Ngân hàng"
                            value="Vietcombank"
                            onCopy={() => void copyText("Vietcombank")}
                            compact
                          />
                          <PayRow
                            label="Số tài khoản"
                            value="0911000037110"
                            onCopy={() => void copyText("0911000037110")}
                            compact
                          />
                          <PayRow
                            label="Số tiền"
                            value={formatVnd(guestAmountToPay)}
                            onCopy={() => void copyText(String(Math.round(guestAmountToPay)))}
                            compact
                          />
                          <PayRow
                            label="Nội dung"
                            value={guestPaymentContent}
                            onCopy={() => void copyText(guestPaymentContent)}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {role === "admin" ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <KeyValueTable title="Tổng tiền theo ngân hàng/thẻ" data={summary.totalByBank} />
              <KeyValueTable title="Tổng tiền theo danh mục (keyword)" data={summary.totalByCategory} />
            </div>
          ) : null}

          {role === "admin" ? <PersonTable title="Tổng tiền theo người đặt" totals={summary.totalByPerson} /> : null}

          <TransactionsTable
            rows={baseFiltered}
            showBank={role === "admin"}
            exportBase={{
              month: month || undefined,
              bank: role === "admin" ? bank || undefined : undefined,
              person: role === "admin" ? person || undefined : undefined,
            }}
          />
        </>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v1.5a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 3.75 18.75v-7.5A2.25 2.25 0 0 1 6 9h1.5m6-6H18A2.25 2.25 0 0 1 20.25 5.25v7.5A2.25 2.25 0 0 1 18 15h-7.5a2.25 2.25 0 0 1-2.25-2.25V5.25A2.25 2.25 0 0 1 10.5 3h3Z"
      />
    </svg>
  );
}

function PayRow({
  label,
  value,
  onCopy,
  compact,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white ${compact ? "p-2" : "p-3"}`}>
      <div className={`min-w-[120px] font-medium text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>{label}</div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className={`truncate font-medium text-slate-900 ${compact ? "text-sm" : "text-sm"}`}>{value}</div>
        <button
          onClick={onCopy}
          className={`inline-flex items-center gap-2 rounded-md border bg-white hover:bg-slate-50 ${compact ? "px-2 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
        >
          <CopyIcon />
          Copy
        </button>
      </div>
    </div>
  );
}
