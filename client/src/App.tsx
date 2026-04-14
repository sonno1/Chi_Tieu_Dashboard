import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";

export default function App() {
  const { state } = useAuth();

  if (state.status === "loading") {
    return (
      <Shell>
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
          Đang tải...
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route
          path="/"
          element={
            state.status === "authed" ? <DashboardPage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={state.status === "authed" ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
