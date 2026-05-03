import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

const CAT_COLORS = ["#D97706", "#0D9488", "#EA580C", "#8B5CF6"];
const TICKET_COLORS = ["#D97706", "#7C3AED", "#0D9488", "#EA580C"];

const tabs = ["Overview", "Revenue", "Tickets"] as const;

const fallbackMonthly = [
  { month: "Jan", revenue: 0, tickets: 0 },
  { month: "Feb", revenue: 0, tickets: 0 },
  { month: "Mar", revenue: 0, tickets: 0 },
  { month: "Apr", revenue: 0, tickets: 0 },
  { month: "May", revenue: 0, tickets: 0 },
  { month: "Jun", revenue: 0, tickets: 0 },
];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<string>("Overview");
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<{ month: string; revenue: number; tickets: number }[]>(fallbackMonthly);
  const [revenueByEvent, setRevenueByEvent] = useState<{ event: string; revenue: number }[]>([]);
  const [ticketTypeBreakdown, setTicketTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([
  { name: "Tech", value: 45 },
  { name: "Music", value: 25 },
  { name: "Food", value: 15 },
  { name: "Sports", value: 15 },
]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const { data, error } = await supabase
      .from("issued_tickets")
      .select(
        "created_at, ticket_tiers ( tier_name, price_cents, events ( name ) )"
      );
    if (error) return;

    const rows = (data ?? []) as {
      created_at: string;
      ticket_tiers: { tier_name: string; price_cents: number; events: { name: string } | null } | null;
    }[];

    const monthKey = (iso: string) => format(startOfMonth(parseISO(iso)), "yyyy-MM");
    const monthLabel = (key: string) => format(parseISO(`${key}-01`), "MMM");

    const bucket: Record<string, { revenue: number; tickets: number }> = {};
    const byEvent: Record<string, number> = {};
    const byTier: Record<string, number> = {};

    for (const r of rows) {
      const t = r.ticket_tiers;
      if (!t) continue;
      const mk = monthKey(r.created_at);
      if (!bucket[mk]) bucket[mk] = { revenue: 0, tickets: 0 };
      bucket[mk].revenue += t.price_cents / 100;
      bucket[mk].tickets += 1;
      const evName = t.events?.name ?? "Other";
      byEvent[evName] = (byEvent[evName] ?? 0) + t.price_cents / 100;
      byTier[t.tier_name] = (byTier[t.tier_name] ?? 0) + 1;
    }

    const sortedMonths = Object.keys(bucket).sort();
    const last6 = sortedMonths.slice(-6);
    const monthlyRows =
      last6.length > 0
        ? last6.map((k) => ({
            month: monthLabel(k),
            revenue: Math.round(bucket[k].revenue),
            tickets: bucket[k].tickets,
          }))
        : fallbackMonthly;

    setMonthly(monthlyRows.length ? monthlyRows : fallbackMonthly);
    setRevenueByEvent(
      Object.entries(byEvent)
        .map(([event, revenue]) => ({ event, revenue: Math.round(revenue) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)
    );
    const tierPie = Object.entries(byTier).map(([name, value]) => ({ name, value }));
    setTicketTypeBreakdown(tierPie.length ? tierPie : [{ name: "General", value: 1 }]);

    if (rows.length === 0) {
      setCategoryData([
        { name: "Tech", value: 1 },
        { name: "Music", value: 1 },
        { name: "Food", value: 1 },
        { name: "Sports", value: 1 },
      ]);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const totalRevenue = useMemo(() => monthly.reduce((s, r) => s + r.revenue, 0), [monthly]);
  const totalTickets = useMemo(() => monthly.reduce((s, r) => s + r.tickets, 0), [monthly]);
  const lastMonth = monthly[monthly.length - 1];
  const avgTicket =
    lastMonth && lastMonth.tickets > 0 ? (lastMonth.revenue / lastMonth.tickets).toFixed(2) : "0.00";

  const kpis = [
    { label: "Revenue (chart period)", value: `$${totalRevenue.toLocaleString()}`, change: "+0%", up: true, gradient: "linear-gradient(135deg, #D97706, #F59E0B)", shadow: "rgba(217,119,6,0.2)" },
    { label: "Tickets (chart period)", value: String(totalTickets), change: "+0%", up: true, gradient: "linear-gradient(135deg, #0D9488, #2DD4BF)", shadow: "rgba(13,148,136,0.2)" },
    { label: "Avg. Ticket Price", value: `$${avgTicket}`, change: "—", up: true, gradient: "linear-gradient(135deg, #EA580C, #FB923C)", shadow: "rgba(234,88,12,0.2)" },
    { label: "Conversion Rate", value: "—", change: "—", up: true, gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)", shadow: "rgba(124,58,237,0.2)" },
  ];

  const monthlyRevenue = monthly.map(({ month, revenue }) => ({ month, revenue }));
  const ticketTrend = monthly.map(({ month, tickets }) => ({ month, tickets }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h1 className="text-2xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>Analytics</h1>
      <p className="text-sm mb-7" style={{ color: "#9CA3AF", fontWeight: 500 }}>Track your event performance from issued tickets</p>
      {loading && <p className="text-sm mb-4" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading analytics…</p>}

      <div className="flex gap-1 p-1.5 rounded-xl mb-7 w-fit" style={{ backgroundColor: "#FEF3C7" }}>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-5 py-2.5 rounded-lg text-sm cursor-pointer transition-all"
            style={{
              fontWeight: 700,
              backgroundColor: tab === t ? "#D97706" : "transparent",
              color: tab === t ? "#fff" : "#92400E",
              boxShadow: tab === t ? "0 2px 8px rgba(217,119,6,0.3)" : "none",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {(tab === "Overview" ? kpis : tab === "Revenue" ? kpis.filter((k) => /Revenue|Price|Conversion/.test(k.label)) : kpis.filter((k) => /Tickets|Conversion/.test(k.label))).map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white rounded-2xl p-5 hover:scale-[1.02] transition-transform"
            style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>{k.label}</p>
              <div
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: k.up ? "#DCFCE7" : "#FEE2E2", color: k.up ? "#16A34A" : "#DC2626", fontWeight: 700 }}
              >
                {k.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {k.change}
              </div>
            </div>
            <p className="text-2xl" style={{ color: "#78350F", fontWeight: 800 }}>{k.value}</p>
            <div className="w-full h-1.5 rounded-full mt-3" style={{ backgroundColor: "#FEF3C7" }}>
              <div className="h-full rounded-full w-3/4" style={{ background: k.gradient }} />
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === "Overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
                <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Monthly Revenue</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FDE68A40" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: 600 }} />
                    <Bar dataKey="revenue" fill="#D97706" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
                <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Ticket Sales Trend</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={ticketTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FDE68A40" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: 600 }} />
                    <Line type="monotone" dataKey="tickets" stroke="#0D9488" strokeWidth={3} dot={{ fill: "#0D9488", r: 5, strokeWidth: 2, stroke: "#fff" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 max-w-md" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-2" style={{ color: "#78350F", fontWeight: 800 }}>Placeholder categories</h2>
              <p className="text-xs mb-3" style={{ color: "#9CA3AF", fontWeight: 500 }}>Categorize events in the database to replace this chart.</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={75} dataKey="value" paddingAngle={3} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} style={{ fontSize: 11, fontWeight: 700 }}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" formatter={(v: string) => <span style={{ color: "#78350F", fontSize: 12, fontWeight: 600 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "Revenue" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Monthly Revenue</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FDE68A40" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: 600 }} />
                  <Bar dataKey="revenue" fill="#D97706" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Revenue by Event</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByEvent.length ? revenueByEvent : [{ event: "—", revenue: 0 }]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#FDE68A40" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                  <YAxis type="category" dataKey="event" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} width={90} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: 600 }} />
                  <Bar dataKey="revenue" fill="#F59E0B" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6 lg:col-span-2" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Total Revenue (period)</h2>
              <p className="text-3xl" style={{ color: "#78350F", fontWeight: 900 }}>
                ${totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF", fontWeight: 600 }}>Based on months shown above</p>
            </div>
          </div>
        )}

        {tab === "Tickets" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Ticket Sales Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ticketTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FDE68A40" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: 600 }} />
                  <Line type="monotone" dataKey="tickets" stroke="#0D9488" strokeWidth={3} dot={{ fill: "#0D9488", r: 5, strokeWidth: 2, stroke: "#fff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Tickets by Type</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={ticketTypeBreakdown} cx="50%" cy="50%" outerRadius={90} dataKey="value" paddingAngle={3} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} style={{ fontSize: 11, fontWeight: 700 }}>
                    {ticketTypeBreakdown.map((_, i) => <Cell key={i} fill={TICKET_COLORS[i % TICKET_COLORS.length]} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" formatter={(v: string) => <span style={{ color: "#78350F", fontSize: 12, fontWeight: 600 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-6 lg:col-span-2" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
              <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Total Tickets (period)</h2>
              <p className="text-3xl" style={{ color: "#78350F", fontWeight: 900 }}>
                {totalTickets.toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF", fontWeight: 600 }}>Issued tickets in the loaded period</p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
