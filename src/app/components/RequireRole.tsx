import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import type { AppRole } from "../../lib/database.types";

export default function RequireRole({
  allow,
  children,
}: {
  allow: AppRole[];
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading || !profile) {
    return (
      <div className="py-20 text-center text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
        Loading…
      </div>
    );
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
