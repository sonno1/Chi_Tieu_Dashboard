import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "../api";
import { login as apiLogin, logout as apiLogout, me as apiMe } from "../api";

type AuthState =
  | { status: "loading"; session: null }
  | { status: "anonymous"; session: null }
  | { status: "authed"; session: Session };

type AuthContextValue = {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", session: null });

  const refresh = useCallback(async () => {
    setState({ status: "loading", session: null });
    const res = await apiMe();
    if (res.session) setState({ status: "authed", session: res.session });
    else setState({ status: "anonymous", session: null });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    setState({ status: "authed", session: res.session });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ status: "anonymous", session: null });
  }, []);

  const value = useMemo(() => ({ state, login, logout, refresh }), [state, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

