import { useNavigate, useLocation, Outlet } from "react-router";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  ScanLine,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Ticket,
  Search,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { navAllowedForRole } from "../auth/rbac";

const F = "Nunito, sans-serif";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", key: "dashboard" as const },
  { icon: CalendarDays, label: "My Events", path: "/dashboard/events", key: "events" as const },
  { icon: ShoppingCart, label: "Sell Tickets", path: "/dashboard/sell-tickets", key: "sellTickets" as const },
  { icon: ScanLine, label: "Gate Scanner", path: "/dashboard/gate-scanner", key: "gateScanner" as const },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics", key: "analytics" as const },
  { icon: Settings, label: "Settings", path: "/dashboard/settings", key: "settings" as const },
];

const navLinkMap: { label: string; path: string; key: keyof ReturnType<typeof navAllowedForRole> }[] = [
  { label: "Dashboard", path: "/dashboard", key: "dashboard" },
  { label: "My Events", path: "/dashboard/events", key: "events" },
  { label: "Tickets", path: "/dashboard/sell-tickets", key: "sellTickets" },
  { label: "Analytics", path: "/dashboard/analytics", key: "analytics" },
];

function initials(name: string, email: string) {
  const n = name.trim();
  if (n) {
    const p = n.split(/\s+/).filter(Boolean);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const allowed = navAllowedForRole(profile?.role);

  const visibleSidebar = sidebarItems.filter((item) => allowed[item.key]);
  const visibleTopNav = navLinkMap.filter((item) => allowed[item.key]);

  const displayName = profile?.full_name || user?.email || "User";
  const email = user?.email ?? "";
  const av = initials(displayName, email);

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-screen" style={{ fontFamily: F, backgroundColor: "#FFFDF7" }}>
      <aside className="hidden md:flex flex-col w-[250px] shrink-0 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #78350F 0%, #92400E 100%)" }}>
        <div className="absolute top-[-40px] right-[-40px] w-32 h-32 rounded-full opacity-10" style={{ background: "#FCD34D" }} />
        <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 rounded-full opacity-5" style={{ background: "#fff" }} />

        <div className="p-6 pb-4 flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
            <Ticket size={18} className="text-white" />
          </div>
          <span className="text-xl text-white cursor-pointer" style={{ fontWeight: 900 }} onClick={() => navigate("/dashboard")}>
            TicketFlow
          </span>
        </div>

        <div className="px-4 mb-4 relative z-10">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-white/40 outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", fontWeight: 500 }}
            />
          </div>
        </div>

        <p className="px-6 text-[10px] uppercase tracking-wider text-white/30 mb-2 relative z-10" style={{ fontWeight: 700 }}>Menu</p>

        <nav className="flex-1 px-3 space-y-1 relative z-10 overflow-y-auto">
          {visibleSidebar.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm transition-all text-left cursor-pointer"
              style={{
                fontWeight: isActive(item.path) ? 700 : 500,
                background: isActive(item.path) ? "linear-gradient(135deg, #D97706, #F59E0B)" : "transparent",
                color: isActive(item.path) ? "#fff" : "rgba(255,255,255,0.65)",
                boxShadow: isActive(item.path) ? "0 2px 10px rgba(217,119,6,0.4)" : "none",
              }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 relative z-10">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 800 }}>
              {av}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs truncate" style={{ fontWeight: 700 }}>{displayName}</p>
              <p className="text-white/40 text-[10px]" style={{ fontWeight: 500 }}>{profile ? roleLabel(profile.role) : "…"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer mt-2"
            style={{ fontWeight: 600 }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3.5 shrink-0 border-b" style={{ backgroundColor: "#fff", borderColor: "#FDE68A40" }}>
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
              <Ticket size={16} className="text-white" />
            </div>
            <span className="text-lg" style={{ color: "#78350F", fontWeight: 900 }}>TicketFlow</span>
          </div>
          <nav className="hidden md:flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "#FFFBEB" }}>
            {visibleTopNav.map(({ label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
                style={{
                  fontWeight: isActive(path) ? 700 : 500,
                  backgroundColor: isActive(path) ? "#fff" : "transparent",
                  color: isActive(path) ? "#78350F" : "#9CA3AF",
                  boxShadow: isActive(path) ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" className="relative w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors hover:bg-amber-50" style={{ color: "#B45309" }}>
              <Bell size={19} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: "#EF4444" }} />
            </button>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs"
              style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 800 }}
            >
              {av}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
