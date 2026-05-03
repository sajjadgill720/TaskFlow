import { Navigate, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";

export default function DashboardRoot() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFFDF7", fontFamily: "Nunito, sans-serif" }}>
        <p style={{ color: "#92400E", fontWeight: 700 }}>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
