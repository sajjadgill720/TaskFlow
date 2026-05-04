import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, CheckCircle2, XCircle, Search, ShieldCheck, ShieldAlert, Loader2, Camera, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

const QR_READER_ELEMENT_ID = "gate-html5-qrcode-reader";

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

/** Ticket QRs encode either `BK-…` only or `BK-…|…` payload (organizer or self-purchase). */
function extractBookingReference(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const pipe = t.indexOf("|");
  if (pipe > 0) return t.slice(0, pipe).trim();
  return t;
}

type IssuedLookupRow = {
  id: string;
  booking_code: string;
  buyer_name: string;
  checked_in_at: string | null;
  ticket_tiers: { tier_name: string; events: { name: string } | null } | null;
};

export default function GateScannerPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [manualId, setManualId] = useState("");
  const [lastResult, setLastResult] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);

  const html5Ref = useRef<Html5Qrcode | null>(null);
  const submittingRef = useRef(false);
  const lastQrRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const submitScanCodeRef = useRef<(raw: string) => Promise<void>>(async () => {});

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

  const submitScanCode = useCallback(
    async (rawInput: string) => {
      if (!isSupabaseConfigured || !user) {
        toast.error("Sign in and configure Supabase.");
        return;
      }
      if (submittingRef.current) return;

      const trimmedRaw = rawInput.trim();
      const code = extractBookingReference(trimmedRaw);
      if (!code) return;

      submittingRef.current = true;
      setScanSubmitting(true);
      try {
        let row: IssuedLookupRow | null = null;
        let error: { message: string } | null = null;

        const first = await supabase
          .from("issued_tickets")
          .select("id, booking_code, buyer_name, checked_in_at, ticket_tiers ( tier_name, events ( name ) )")
          .eq("booking_code", code)
          .maybeSingle();

        if (first.error) {
          error = first.error;
        } else {
          row = first.data as IssuedLookupRow | null;
        }

        if (!row && !error && trimmedRaw.includes("|")) {
          const second = await supabase
            .from("issued_tickets")
            .select("id, booking_code, buyer_name, checked_in_at, ticket_tiers ( tier_name, events ( name ) )")
            .eq("qr_payload", trimmedRaw)
            .maybeSingle();
          if (second.error) {
            error = second.error;
          } else {
            row = second.data as IssuedLookupRow | null;
          }
        }

        if (error) {
          toast.error(error.message);
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
          return;
        }

        const ticket = row;

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
          return;
        }

        const { error: upErr } = await supabase
          .from("issued_tickets")
          .update({ checked_in_at: new Date().toISOString() })
          .eq("id", ticket.id);

        if (upErr) {
          toast.error(upErr.message);
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
        setScans((prev) => [valid, ...prev.filter((s) => s.id !== valid.id || s.status !== "Valid")]);
        await loadRecent();
      } finally {
        submittingRef.current = false;
        setScanSubmitting(false);
      }
    },
    [user, loadRecent]
  );

  useEffect(() => {
    submitScanCodeRef.current = submitScanCode;
  }, [submitScanCode]);

  const stopCamera = useCallback(async () => {
    const inst = html5Ref.current;
    html5Ref.current = null;
    setCameraOn(false);
    if (!inst) return;
    try {
      await inst.stop();
      inst.clear();
    } catch {
      try {
        inst.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const onQrDetected = useCallback((decodedText: string) => {
    const trimmed = decodedText.trim();
    const ref = extractBookingReference(trimmed);
    const now = Date.now();
    const { key, at } = lastQrRef.current;
    if (!ref || submittingRef.current) return;
    if (ref === key && now - at < 2200) return;
    lastQrRef.current = { key: ref, at: now };
    void submitScanCodeRef.current(trimmed);
  }, []);

  const startCamera = useCallback(async () => {
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured.");
      return;
    }
    if (html5Ref.current || cameraBusy) return;
    setCameraBusy(true);
    try {
      await stopCamera();
      const region = document.getElementById(QR_READER_ELEMENT_ID);
      if (!region) {
        toast.error("Scanner view is not ready.");
        return;
      }
      let scanner: Html5Qrcode | null = null;
      try {
        scanner = new Html5Qrcode(QR_READER_ELEMENT_ID);
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 12,
            aspectRatio: 1,
            qrbox: (vw, vh) => {
              const m = Math.min(vw, vh);
              const s = Math.max(140, Math.floor(m * 0.72));
              return { width: s, height: s };
            },
          },
          (text) => onQrDetected(text),
          () => {}
        );
        html5Ref.current = scanner;
        setCameraOn(true);
      } catch (inner) {
        if (scanner) {
          try {
            await scanner.stop();
          } catch {
            /* noop */
          }
          try {
            scanner.clear();
          } catch {
            /* noop */
          }
        }
        throw inner;
      }
    } catch (e) {
      html5Ref.current = null;
      const msg = e instanceof Error ? e.message : "Could not start camera";
      toast.error(msg);
    } finally {
      setCameraBusy(false);
    }
  }, [cameraBusy, onQrDetected, stopCamera]);

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

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = manualId.trim();
    if (!raw || scanSubmitting) return;
    await submitScanCode(raw);
    setManualId("");
  };

  const todayValid = scans.filter((s) => s.status === "Valid").length;
  const todayTotal = scans.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h1 className="text-2xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>
        Gate Scanner
      </h1>
      <p className="text-sm mb-7" style={{ color: "#9CA3AF", fontWeight: 500 }}>
        Validate tickets at the entrance with the device camera or a booking code (HTTPS recommended for camera access).
      </p>
      {loading && (
        <p className="text-sm mb-4" style={{ color: "#9CA3AF", fontWeight: 600 }}>
          Loading recent check-ins…
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div
          className="lg:col-span-1 flex flex-col rounded-2xl bg-white p-6 text-center"
          style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
        >
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center self-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}
          >
            <ScanLine size={36} className="text-white" />
          </div>

          <h2 className="mb-1 flex items-center justify-center gap-2 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>
            <Camera size={16} aria-hidden /> Scan QR code
          </h2>
          <p className="mb-4 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
            Opens the camera to read TicketFlow QR codes from attendee phones or printouts.
          </p>

          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={cameraBusy || cameraOn}
              onClick={() => void startCamera()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs text-white transition-all hover:opacity-95 disabled:pointer-events-none disabled:opacity-50 sm:text-sm"
              style={{ background: "linear-gradient(135deg, #0D9488, #14B8A6)", fontWeight: 700 }}
            >
              {cameraBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />}
              {cameraBusy ? "Starting…" : cameraOn ? "Camera on" : "Start camera"}
            </button>
            <button
              type="button"
              disabled={!cameraOn || cameraBusy}
              onClick={() => void stopCamera()}
              className="inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-xs disabled:opacity-50 sm:text-sm"
              style={{ borderColor: "#FDE68A", color: "#92400E", fontWeight: 700 }}
            >
              <VideoOff size={16} aria-hidden />
              Stop camera
            </button>
          </div>

          <div
            id={QR_READER_ELEMENT_ID}
            className="mx-auto w-full max-w-[min(100%,340px)] min-h-[200px] overflow-hidden rounded-xl border-2 bg-black sm:min-h-[240px]"
            style={{ borderColor: "#FDE68A" }}
          />

          {scanSubmitting && (
            <p className="mt-2 flex items-center justify-center gap-2 text-xs" style={{ color: "#92400E", fontWeight: 600 }}>
              <Loader2 size={14} className="animate-spin" aria-hidden /> Processing ticket…
            </p>
          )}

          <div className="mt-8 w-full border-t pt-8" style={{ borderColor: "#FDE68A40" }}>
            <h2 className="mb-1 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>
              Manual ticket check
            </h2>
            <p className="mb-5 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
              Enter booking code (e.g. BK-AB12CD34EF) or paste full QR payload
            </p>
            <form onSubmit={(e) => void handleManualScan(e)} className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
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
                {scanSubmitting ? "Scanning…" : "Check"}
              </button>
            </form>
          </div>

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
              <p className="text-sm" style={{ fontWeight: 800, color: statusConfig[lastResult.status].color }}>
                {lastResult.status}
              </p>
              <p className="mt-1 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                {lastResult.attendee} — {lastResult.ticketType}
              </p>
            </motion.div>
          )}

          <div className="flex w-full gap-8 mt-6 pt-5 border-t justify-center" style={{ borderColor: "#FDE68A40" }}>
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center gap-1">
                <ShieldCheck size={14} className="text-green-500" />
                <p className="text-xl" style={{ color: "#16A34A", fontWeight: 800 }}>
                  {todayValid}
                </p>
              </div>
              <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>
                Valid (this list)
              </p>
            </div>
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center gap-1">
                <ShieldAlert size={14} className="text-amber-500" />
                <p className="text-xl" style={{ color: "#78350F", fontWeight: 800 }}>
                  {todayTotal}
                </p>
              </div>
              <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>
                Rows shown
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-white p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          <h2 className="mb-5 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>
            Recent check-ins
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: "#FDE68A40" }}>
                  {["Ticket ID", "Attendee", "Event", "Time", "Status"].map((h) => (
                    <th key={h} className="pb-3 text-xs" style={{ fontWeight: 700, color: "#B45309" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.map((s, i) => {
                  const cfg = statusConfig[s.status];
                  return (
                    <tr key={`${s.id}-${i}`} className="border-b border-gray-50 transition-colors hover:bg-amber-50/30">
                      <td className="py-3.5" style={{ color: "#78350F", fontWeight: 700 }}>
                        {s.id}
                      </td>
                      <td className="py-3.5" style={{ color: "#6B7280", fontWeight: 500 }}>
                        {s.attendee}
                      </td>
                      <td className="py-3.5" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                        {s.event}
                      </td>
                      <td className="py-3.5" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                        {s.time}
                      </td>
                      <td className="py-3.5">
                        <span className="rounded-full px-3 py-1 text-xs" style={{ fontWeight: 700, backgroundColor: cfg.bg, color: cfg.color }}>
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
            <p className="mt-4 text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>
              No check-ins yet. Scan a QR code or enter a booking code to record entry.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
