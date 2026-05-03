import { useCallback, useEffect, useState } from "react";
import { Calendar, Ticket, DollarSign, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import type { AppRole } from "../../lib/database.types";

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  location: string;
  status: "Active" | "Upcoming" | "Closed";
  ticket_tiers: { sold: number; quantity: number; price_cents: number; tier_name: string }[] | null;
};

type IssuedRow = {
  booking_code: string;
  checked_in_at: string | null;
  created_at: string;
  ticket_tiers: {
    tier_name: string;
    price_cents: number;
    events: { name: string; event_date: string } | null;
  } | null;
};

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: "#DCFCE7", text: "#16A34A" },
  Upcoming: { bg: "#FEF3C7", text: "#D97706" },
  Closed: { bg: "#F3F4F6", text: "#6B7280" },
};

const DONUT_COLORS = ["#F59E0B", "#0D9488", "#EA580C"];

function staffRole(role: AppRole | undefined) {
  return role === "organizer" || role === "admin";
}

export default function DashboardHome() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [revenueCents, setRevenueCents] = useState(0);
  const [checkedIn, setCheckedIn] = useState(0);
  const [totalIssued, setTotalIssued] = useState(0);
  const [donutData, setDonutData] = useState<{ name: string; value: number }[]>([]);
  const [myTickets, setMyTickets] = useState<IssuedRow[]>([]);

  const firstName = profile?.full_name?.split(/\s+/)[0] || user?.email?.split("@")[0] || "there";

  const loadStaff = useCallback(async () => {
    const { data: evs, error: evErr } = await supabase
      .from("events")
      .select("id,name,event_date,location,status,ticket_tiers(sold,quantity,price_cents,tier_name)")
      .order("event_date", { ascending: false })
      .limit(12);
    if (evErr) throw evErr;
    const list = (evs ?? []) as EventRow[];
    setEvents(list);

    const { data: issued, error: isErr } = await supabase
      .from("issued_tickets")
      .select("id, checked_in_at, ticket_tiers ( price_cents, tier_name )");
    if (isErr) throw isErr;
    const rows = (issued ?? []) as {
      id: string;
      checked_in_at: string | null;
      ticket_tiers: { price_cents: number; tier_name: string } | null;
    }[];

    let rev = 0;
    let checked = 0;
    const bucket: Record<string, number> = { Free: 0, Paid: 0, VIP: 0 };
    for (const r of rows) {
      if (r.checked_in_at) checked += 1;
      const tier = r.ticket_tiers;
      if (!tier) continue;
      rev += tier.price_cents;
      const label = tier.tier_name;
      if (label in bucket) bucket[label] += 1;
      else bucket.Paid += 1;
    }
    setRevenueCents(rev);
    setCheckedIn(checked);
    setTotalIssued(rows.length);
    setDonutData(
      Object.entries(bucket)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    );
  }, []);

  const loadAttendee = useCallback(async (email: string) => {
    const { data, error } = await supabase
      .from("issued_tickets")
      .select(
        `
        booking_code,
        checked_in_at,
        created_at,
        ticket_tiers ( tier_name, price_cents, events ( name, event_date ) )
      `
      )
      .ilike("buyer_email", email)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setMyTickets((data ?? []) as IssuedRow[]);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (staffRole(profile.role)) {
          await loadStaff();
        } else {
          await loadAttendee(user.email ?? "");
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
          setMyTickets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, user, loadStaff, loadAttendee]);

  if (!profile) return null;

  if (!staffRole(profile.role)) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="rounded-2xl p-6 mb-8 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #78350F 0%, #B45309 50%, #D97706 100%)" }}>
          <div className="relative z-10">
            <h1 className="text-2xl text-white mb-1" style={{ fontWeight: 800 }}>Hi, {firstName}!</h1>
            <p className="text-white/60 text-sm" style={{ fontWeight: 500 }}>Your tickets and check-in status.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading your tickets…</p>
        ) : myTickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
            <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>No tickets yet. When an organizer books with your email, they appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "#FDE68A40" }}>
                  {["Event", "Tier", "Booking", "Check-in"].map((h) => (
                    <th key={h} className="px-5 py-4 text-xs" style={{ fontWeight: 700, color: "#B45309" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myTickets.map((t) => {
                  const ev = t.ticket_tiers?.events;
                  const dateLabel = ev?.event_date
                    ? format(parseISO(ev.event_date), "MMM d, yyyy")
                    : "—";
                  return (
                    <tr key={t.booking_code} className="border-b border-gray-50">
                      <td className="px-5 py-4" style={{ color: "#78350F", fontWeight: 700 }}>
                        {ev?.name ?? "—"}
                        <div className="text-xs font-normal text-gray-400">{dateLabel}</div>
                      </td>
                      <td className="px-5 py-4" style={{ color: "#6B7280", fontWeight: 500 }}>{t.ticket_tiers?.tier_name ?? "—"}</td>
                      <td className="px-5 py-4 font-mono text-xs" style={{ color: "#78350F", fontWeight: 700 }}>{t.booking_code}</td>
                      <td className="px-5 py-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs"
                          style={{
                            fontWeight: 700,
                            backgroundColor: t.checked_in_at ? "#DCFCE7" : "#FEF3C7",
                            color: t.checked_in_at ? "#16A34A" : "#D97706",
                          }}
                        >
                          {t.checked_in_at ? "Checked in" : "Not checked in"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    );
  }

  const totalEvents = events.length;
  const ticketsSold = events.reduce((s, e) => s + (e.ticket_tiers?.reduce((a, t) => a + t.sold, 0) ?? 0), 0);
  const revenueUsd = (revenueCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
  const attendanceRate = totalIssued > 0 ? Math.round((checkedIn / totalIssued) * 100) : 0;

  const stats = [
    { label: "Total Events", value: String(totalEvents), icon: Calendar, gradient: "linear-gradient(135deg, #D97706, #F59E0B)", shadow: "rgba(217,119,6,0.25)" },
    { label: "Tickets Sold", value: ticketsSold.toLocaleString(), icon: Ticket, gradient: "linear-gradient(135deg, #16A34A, #4ADE80)", shadow: "rgba(22,163,74,0.25)" },
    { label: "Total Revenue", value: revenueUsd, icon: DollarSign, gradient: "linear-gradient(135deg, #0D9488, #2DD4BF)", shadow: "rgba(13,148,136,0.25)" },
    { label: "Attendance Rate", value: `${attendanceRate}%`, icon: Users, gradient: "linear-gradient(135deg, #EA580C, #FB923C)", shadow: "rgba(234,88,12,0.25)" },
  ];

  const recentRows = events.slice(0, 4).map((e) => {
    const sold = e.ticket_tiers?.reduce((a, t) => a + t.sold, 0) ?? 0;
    const cap = e.ticket_tiers?.reduce((a, t) => a + t.quantity, 0) ?? 0;
    return {
      name: e.name,
      date: e.event_date ? format(parseISO(e.event_date), "MMM d, yyyy") : "—",
      tickets: sold,
      cap,
      status: e.status,
    };
  });

  const chartData = donutData.length > 0 ? donutData : [
    { name: "Free", value: 1 },
    { name: "Paid", value: 1 },
    { name: "VIP", value: 1 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="rounded-2xl p-6 mb-8 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #78350F 0%, #B45309 50%, #D97706 100%)" }}>
        <div className="absolute top-[-30px] right-[-30px] w-40 h-40 rounded-full opacity-15" style={{ background: "#FCD34D" }} />
        <div className="absolute bottom-[-20px] right-20 w-24 h-24 rounded-2xl rotate-45 opacity-10" style={{ background: "#fff" }} />
        <div className="relative z-10">
          <h1 className="text-2xl text-white mb-1" style={{ fontWeight: 800 }}>Welcome back, {firstName}!</h1>
          <p className="text-white/60 text-sm" style={{ fontWeight: 500 }}>
            {loading ? "Loading your workspace…" : "Here is what is happening with your events."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-5 hover:scale-[1.02] transition-transform cursor-default"
            style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: s.gradient, boxShadow: `0 4px 12px ${s.shadow}` }}>
                <s.icon size={20} className="text-white" />
              </div>
            </div>
            <p className="text-xs mb-1" style={{ color: "#9CA3AF", fontWeight: 600 }}>{s.label}</p>
            <p className="text-2xl" style={{ color: "#78350F", fontWeight: 800 }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3 bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Recent Events</h2>
            <button type="button" onClick={() => navigate("/dashboard/events")} className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "#D97706", fontWeight: 700 }}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "#FDE68A40" }}>
                  {["Event Name", "Date", "Tickets Sold", "Status"].map((h) => (
                    <th key={h} className="pb-3 text-xs" style={{ fontWeight: 700, color: "#B45309" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>
                      No events yet. Create one from My Events.
                    </td>
                  </tr>
                ) : (
                  recentRows.map((ev) => (
                    <tr key={ev.name} className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5" style={{ color: "#78350F", fontWeight: 700 }}>{ev.name}</td>
                      <td className="py-3.5" style={{ color: "#9CA3AF", fontWeight: 500 }}>{ev.date}</td>
                      <td className="py-3.5" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                        {ev.tickets}
                        {ev.cap > 0 ? ` / ${ev.cap}` : ""}
                      </td>
                      <td className="py-3.5">
                        <span
                          className="px-3 py-1 rounded-full text-xs"
                          style={{ fontWeight: 700, backgroundColor: statusColors[ev.status].bg, color: statusColors[ev.status].text }}
                        >
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          <h2 className="text-sm mb-2" style={{ color: "#78350F", fontWeight: 800 }}>Issued by tier</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4} strokeWidth={0}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" formatter={(value: string) => <span style={{ color: "#78350F", fontSize: 12, fontWeight: 600 }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => navigate("/dashboard/events")}
          className="px-7 py-3 rounded-xl text-white text-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}
        >
          My Events <ArrowRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard/analytics")}
          className="px-7 py-3 rounded-xl text-sm border-2 cursor-pointer hover:bg-amber-50 transition-all flex items-center gap-2"
          style={{ borderColor: "#D97706", color: "#D97706", fontWeight: 700 }}
        >
          View Reports
        </button>
      </div>
    </motion.div>
  );
}
