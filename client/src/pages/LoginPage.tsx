import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { state, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => !username.trim() || !password.trim() || loading, [username, password, loading]);

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Đăng nhập</h1>
        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="text-sm font-medium">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Tên đăng nhập"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
          <button
            disabled={disabled}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                await login(username.trim(), password);
                nav("/");
              } catch {
                setError("Sai username hoặc password.");
              } finally {
                setLoading(false);
              }
            }}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </div>

        {state.status === "loading" ? (
          <div className="mt-3 text-xs text-slate-500">Đang kiểm tra phiên đăng nhập...</div>
        ) : null}
      </div>
    </div>
  );
}

