import { normalizeText } from "./normalize";
import { CategoryRule, Summary, Transaction } from "./types";

function matchesStatus(status: string | undefined, expected: "paid" | "unpaid"): boolean {
  const s = normalizeText(status);
  if (!s) return false;
  if (expected === "paid") return s.includes("da tra");
  return s.includes("chua tra");
}

export function categorize(content: string, rules: CategoryRule[]): string {
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

export function buildSummary(transactions: Transaction[], rules: CategoryRule[]): Summary {
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
