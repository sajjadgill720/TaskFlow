import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ScanLine, CheckCircle2, XCircle, Search, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

interface ScanRecord {
  id: string;
  attendee: string;
  event: string;
  ticketType: string;
  time: string;
  status: "Valid" | "Invalid" | "Already Used";
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  Valid: { icon: CheckCircle2, color: "#16A34A", bg: "#DCFCE7" },
  Invalid: { icon: XCircle, color: "#DC2626", bg: "#FEE2E2" },
  "Already Used": { icon: XCircle, color: "#D97706", bg: "#FEF3C7" },
};

export default function GateScannerPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [manualId, setManualId] = useState("");
  const [lastResult, setLastResult] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanSubmitting, setScanSubmitting] = useState(false);

  const loadRecent = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const { data, error } = await supabase
      .from("issued_tickets")
      .select("booking_code, buyer_name, checked_in_at, ticket_tiers ( tier_name, events ( name ) )")
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: false })
      .limit(40);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as {
      booking_code: string;
      buyer_name: string;
      checked_in_at: string;
      ticket_tiers: { tier_name: string; events: { name: string } | null } | null;
    }[];
    setScans(
      rows.map((r) => ({
        id: r.booking_code,
        attendee: r.buyer_name,
        event: r.ticket_tiers?.events?.name ?? "—",
        ticketType: r.ticket_tiers?.tier_name ?? "—",
        time: new Date(r.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "Valid" as const,
      }))
    );
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadRecent();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRecent]);

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualId.trim();
    if (!code || scanSubmitting) return;
    setScanSubmitting(true);
    try {
      const { data: row, error } = await supabase
        .from("issued_tickets")
        .select("id, booking_code, buyer_name, checked_in_at, ticket_tiers ( tier_name, events ( name ) )")
        .eq("booking_code", code)
        .maybeSingle();

      if (error) {
        toast.error(error.message);
        setManualId("");
        return;
      }

      if (!row) {
        const invalid: ScanRecord = {
          id: code,
          attendee: "Unknown",
          event: "\u2014",
          ticketType: "\u2014",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "Invalid",
        };
        setScans((prev) => [invalid, ...prev]);
        setLastResult(invalid);
        setManualId("");
        return;
      }

      const ticket = row as {
        id: string;
        booking_code: string;
        buyer_name: string;
        checked_in_at: string | null;
        ticket_tiers: { tier_name: string; events: { name: string } | null } | null;
      };

      if (ticket.checked_in_at) {
        const used: ScanRecord = {
          id: ticket.booking_code,
          attendee: ticket.buyer_name,
          event: ticket.ticket_tiers?.events?.name ?? "—",
          ticketType: ticket.ticket_tiers?.tier_name ?? "—",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "Already Used",
        };
        setLastResult(used);
        setManualId("");
        return;
      }

      const { error: upErr } = await supabase
        .from("issued_tickets")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", ticket.id);

      if (upErr) {
        toast.error(upErr.message);
        setManualId("");
        return;
      }

      const valid: ScanRecord = {
        id: ticket.booking_code,
        attendee: ticket.buyer_name,
        event: ticket.ticket_tiers?.events?.name ?? "—",
        ticketType: ticket.ticket_tiers?.tier_name ?? "—",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: "Valid",
      };
      setLastResult(valid);
      setScans((prev) => [
        valid,
        ...prev.filter((s) => s.id !== valid.id || s.status !== "Valid"),
      ]);
      setManualId("");
      await loadRecent();
    } finally {
      setScanSubmitting(false);
    }
  };

  const todayValid = scans.filter((s) => s.status === "Valid").length;
  const todayTotal = scans.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h1 className="text-2xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>Gate Scanner</h1>
      <p className="text-sm mb-7" style={{ color: "#9CA3AF", fontWeight: 500 }}>Validate tickets at the entrance</p>
      {loading && <p className="text-sm mb-4" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading recent check-ins…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 flex flex-col items-center text-center" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}>
            <ScanLine size={36} className="text-white" />
          </div>
          <h2 className="text-sm mb-1" style={{ color: "#78350F", fontWeight: 800 }}>Manual Ticket Check</h2>
          <p className="text-xs mb-5" style={{ color: "#9CA3AF", fontWeight: 500 }}>Enter booking code (e.g. BK-AB12CD34EF)</p>
          <form onSubmit={handleManualScan} className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
              <input
                value={manualId}
                disabled={scanSubmitting}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Booking code"
                className="w-full rounded-xl border-2 py-3 pl-9 pr-3 text-sm outline-none transition-all disabled:opacity-60"
                style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
                onFocus={(e) => !scanSubmitting && (e.target.style.borderColor = "#D97706")}
                onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
              />
            </div>
            <button
              type="submit"
              disabled={scanSubmitting}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
              style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700 }}
            >
              {scanSubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
              {scanSubmitting ? "Scanning…" : "Scan"}
            </button>
          </form>

          {lastResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 w-full p-5 rounded-2xl"
              style={{ backgroundColor: statusConfig[lastResult.status].bg }}
            >
              {(() => {
                const Icon = statusConfig[lastResult.status].icon;
                return <Icon size={32} style={{ color: statusConfig[lastResult.status].color }} className="mx-auto mb-2" />;
              })()}
              <p className="text-sm" style={{ fontWeight: 800, color: statusConfig[lastResult.status].color }}>{lastResult.status}</p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF", fontWeight: 500 }}>{lastResult.attendee} — {lastResult.ticketType}</p>
            </motion.div>
          )}

          <div className="flex gap-8 mt-6 pt-5 border-t w-full justify-center" style={{ borderColor: "#FDE68A40" }}>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <ShieldCheck size={14} className="text-green-500" />
                <p className="text-xl" style={{ color: "#16A34A", fontWeight: 800 }}>{todayValid}</p>
              </div>
              <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>Valid (this list)</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <ShieldAlert size={14} className="text-amber-500" />
                <p className="text-xl" style={{ color: "#78350F", fontWeight: 800 }}>{todayTotal}</p>
              </div>
              <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>Rows shown</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          <h2 className="text-sm mb-5" style={{ color: "#78350F", fontWeight: 800 }}>Recent check-ins</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "#FDE68A40" }}>
                  {["Ticket ID", "Attendee", "Event", "Time", "Status"].map((h) => (
                    <th key={h} className="pb-3 text-xs" style={{ fontWeight: 700, color: "#B45309" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.map((s, i) => {
                  const cfg = statusConfig[s.status];
                  return (
                    <tr key={`${s.id}-${i}`} className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5" style={{ color: "#78350F", fontWeight: 700 }}>{s.id}</td>
                      <td className="py-3.5" style={{ color: "#6B7280", fontWeight: 500 }}>{s.attendee}</td>
                      <td className="py-3.5" style={{ color: "#9CA3AF", fontWeight: 500 }}>{s.event}</td>
                      <td className="py-3.5" style={{ color: "#9CA3AF", fontWeight: 500 }}>{s.time}</td>
                      <td className="py-3.5">
                        <span className="px-3 py-1 rounded-full text-xs" style={{ fontWeight: 700, backgroundColor: cfg.bg, color: cfg.color }}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scans.length === 0 && !loading && (
            <p className="text-xs mt-4" style={{ color: "#9CA3AF", fontWeight: 600 }}>No check-ins yet. Scan a booking code to record entry.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
