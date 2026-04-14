import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, logout } = useAuth();

  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-semibold">
            Chi tiêu Dashboard
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {state.status === "authed" ? (
              <>
                <span>
                  {state.session.username} ({state.session.role})
                </span>
                <button
                  onClick={() => void logout()}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
                >
                  Đăng xuất
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

