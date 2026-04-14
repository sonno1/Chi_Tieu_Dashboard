export type Session = {
  username: string;
  role: "admin" | "guest";
  personName?: string;
};

export type CategoryRule = {
  category: string;
  keywords: string[];
};

export type Transaction = {
  sheet: string;
  bank: string;
  stt?: number;
  date?: string;
  content: string;
  amount: number;
  person?: string;
  status?: string;
};

export type Summary = {
  totalSpent: number;
  totalDebt: number;
  totalPaid: number;
  totalUnpaid: number;
  totalByBank: Record<string, number>;
  totalByPerson: Record<string, { total: number; paid: number; unpaid: number }>;
  totalByCategory: Record<string, number>;
};

async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function me(): Promise<{ session: Session | null }> {
  return apiFetch("/api/auth/me", { method: "GET" });
}

export async function login(username: string, password: string): Promise<{ session: Session }> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

export async function getData(): Promise<{
  fetchedAt: number;
  role: "admin" | "guest";
  rules: CategoryRule[];
  payment?: { qr?: string };
  transactions: Transaction[];
  summary: Summary;
  users?: { username: string; personName?: string }[];
}> {
  return apiFetch("/api/data", { method: "GET" });
}

export async function adminRefresh(): Promise<{ ok: boolean }> {
  return apiFetch("/api/admin/refresh", { method: "POST" });
}
