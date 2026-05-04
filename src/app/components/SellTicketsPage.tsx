import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Ticket, Copy, Check, Plus, X, ShoppingCart, CheckCircle2, Download, LayoutDashboard, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { apiUrl } from "../../lib/apiBaseUrl";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

interface TicketRow {
  id: string;
  event: string;
  type: string;
  price: string;
  sold: number;
  total: number;
  status: "On Sale" | "Sold Out" | "Paused";
}

interface Booking {
  id: string;
  event: string;
  tier: string;
  amount: string;
  qrUrl: string;
}

const statusStyle: Record<string, { bg: string; text: string }> = {
  "On Sale": { bg: "#DCFCE7", text: "#16A34A" },
  "Sold Out": { bg: "#FEE2E2", text: "#DC2626" },
  Paused: { bg: "#FEF3C7", text: "#D97706" },
};

function formatPrice(cents: number) {
  if (cents <= 0) return "Free";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function SellTicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ event: "", type: "", price: "", total: "" });
  const [bookingTicket, setBookingTicket] = useState<TicketRow | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [addingTicket, setAddingTicket] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const { data, error } = await supabase
      .from("ticket_tiers")
      .select("id, tier_name, price_cents, quantity, sold, listing_status, events ( name )")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as {
      id: string;
      tier_name: string;
      price_cents: number;
      quantity: number;
      sold: number;
      listing_status: TicketRow["status"];
      events: { name: string } | null;
    }[];
    setTickets(
      rows.map((r) => ({
        id: r.id,
        event: r.events?.name ?? "—",
        type: r.tier_name,
        price: formatPrice(r.price_cents),
        sold: r.sold,
        total: r.quantity,
        status: r.listing_status,
      }))
    );
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

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTicket || bookingSaving) return;
    const row = tickets.find((t) => t.id === bookingTicket.id);
    if (!row || row.status !== "On Sale" || row.sold >= row.total) {
      toast.error("This tier is not available.");
      return;
    }

    setBookingSaving(true);
    try {
      const { data: tierRow, error: fetchErr } = await supabase
        .from("ticket_tiers")
        .select("id, sold, quantity, price_cents, tier_name, events ( name )")
        .eq("id", bookingTicket.id)
        .single();
      if (fetchErr || !tierRow) {
        toast.error(fetchErr?.message ?? "Tier not found");
        return;
      }

      const tr = tierRow as {
        id: string;
        sold: number;
        quantity: number;
        price_cents: number;
        tier_name: string;
        events: { name: string } | null;
      };

      if (tr.sold >= tr.quantity) {
        toast.error("Sold out");
        return;
      }

      const bookingId = `BK-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      const amount = formatPrice(tr.price_cents);
      const payload = `${bookingId}|${tr.events?.name ?? ""}|${tr.tier_name}|${buyerEmail}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;

      const { error: insErr } = await supabase.from("issued_tickets").insert({
        tier_id: tr.id,
        booking_code: bookingId,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        qr_payload: payload,
      });
      if (insErr) {
        toast.error(insErr.message);
        return;
      }

      const { error: upErr } = await supabase.from("ticket_tiers").update({ sold: tr.sold + 1 }).eq("id", tr.id);
      if (upErr) {
        toast.error(upErr.message);
        return;
      }

      setConfirmed({
        id: bookingId,
        event: tr.events?.name ?? "—",
        tier: tr.price_cents <= 0 ? "Free" : "Paid",
        amount: tr.price_cents <= 0 ? "Free" : amount,
        qrUrl,
      });
      setBookingTicket(null);
      setBuyerName("");
      setBuyerEmail("");
      await load();
    } finally {
      setBookingSaving(false);
    }
  };

  const downloadTicket = () => {
    if (!confirmed) return;
    const blob = new Blob(
      [`TicketFlow Booking\n\nID: ${confirmed.id}\nEvent: ${confirmed.event}\nTier: ${confirmed.tier}\nAmount: ${confirmed.amount}\n`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${confirmed.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(apiUrl(`/dashboard/sell-tickets?tier=${encodeURIComponent(id)}`));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user || addingTicket) return;
    setAddingTicket(true);
    try {
    const { data: evMatch, error: evErr } = await supabase
      .from("events")
      .select("id")
      .eq("organizer_id", user.id)
      .eq("name", form.event.trim())
      .maybeSingle();
    if (evErr || !evMatch) {
      toast.error(evErr?.message ?? "Event not found. Create the event first under My Events (exact name).");
      return;
    }

    const priceNum = form.price.trim().toLowerCase() === "free" ? 0 : Number(form.price.replace(/[^0-9.]/g, ""));
    const price_cents = Number.isFinite(priceNum) ? Math.round(priceNum * 100) : 0;
    const total = Number(form.total) || 100;

    const { error } = await supabase.from("ticket_tiers").insert({
      event_id: evMatch.id,
      tier_name: form.type.trim(),
      price_cents,
      quantity: total,
      sold: 0,
      enabled: true,
      listing_status: "On Sale",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket type added");
    setForm({ event: "", type: "", price: "", total: "" });
    setShowModal(false);
    await load();
    } finally {
      setAddingTicket(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-7 gap-4">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>Sell Tickets</h1>
          <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>Manage ticket types and share purchase links</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}
        >
          <Plus size={16} /> Add Ticket Type
        </button>
      </div>

      {loading && <p className="text-sm mb-4" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading ticket types…</p>}

      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: "#FDE68A40" }}>
                {["Event", "Ticket Type", "Price", "Sold", "Status", "Share", "Book"].map((h) => (
                  <th key={h} className="px-5 py-4 text-xs" style={{ fontWeight: 700, color: "#B45309" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors"
                >
                  <td className="px-5 py-4" style={{ color: "#78350F", fontWeight: 700 }}>{t.event}</td>
                  <td className="px-5 py-4 text-gray-600 flex items-center gap-2" style={{ fontWeight: 500 }}>
                    <Ticket size={14} className="text-amber-400" /> {t.type}
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "#FEF3C7", color: "#D97706", fontWeight: 800 }}>{t.price}</span>
                  </td>
                  <td className="px-5 py-4" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                    <span style={{ color: "#78350F", fontWeight: 700 }}>{t.sold}</span> / {t.total}
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-3 py-1 rounded-full text-xs" style={{ fontWeight: 700, backgroundColor: statusStyle[t.status].bg, color: statusStyle[t.status].text }}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => copyLink(t.id)}
                      className="flex items-center gap-1 text-xs cursor-pointer hover:opacity-70 px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: "#D97706", fontWeight: 700, backgroundColor: "#FEF3C7" }}
                    >
                      {copiedId === t.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Link</>}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      disabled={t.status !== "On Sale"}
                      onClick={() => setBookingTicket(t)}
                      className="flex items-center gap-1 text-xs cursor-pointer hover:opacity-90 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
                      style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700 }}
                    >
                      <ShoppingCart size={13} /> Book
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tickets.length === 0 && !loading && (
        <p className="text-center text-sm mt-8" style={{ color: "#9CA3AF", fontWeight: 600 }}>No ticket tiers yet. Create an event, then add types here.</p>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[min(90dvh,640px)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 sm:p-7"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg" style={{ color: "#78350F", fontWeight: 800 }}>Add Ticket Type</h2>
              <button
                type="button"
                disabled={addingTicket}
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-amber-50 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: "Event Name", key: "event", placeholder: "Exact name from My Events" },
                { label: "Ticket Type", key: "type", placeholder: "e.g. VIP, General" },
                { label: "Price (USD or Free)", key: "price", placeholder: "e.g. 25 or Free" },
                { label: "Total Quantity", key: "total", placeholder: "e.g. 500" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>{f.label}</label>
                  <input
                    required
                    disabled={addingTicket}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none transition-all disabled:opacity-60"
                    style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
                    onFocus={(e) => !addingTicket && (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={addingTicket}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.35)" }}
              >
                {addingTicket ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
                {addingTicket ? "Adding…" : "Add Ticket"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {bookingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[min(90dvh,640px)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 sm:p-7"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg" style={{ color: "#78350F", fontWeight: 800 }}>Book Ticket</h2>
              <button
                type="button"
                disabled={bookingSaving}
                onClick={() => setBookingTicket(null)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-amber-50 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-5 p-3 rounded-xl" style={{ background: "#FEF3C7" }}>
              <div className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>{bookingTicket.event}</div>
              <div className="text-xs mt-1" style={{ color: "#92400E", fontWeight: 600 }}>{bookingTicket.type} · {bookingTicket.price}</div>
            </div>
            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Full Name</label>
                <input
                  required
                  disabled={bookingSaving}
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none disabled:opacity-60"
                  style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
                />
              </div>
              <div>
                <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Email</label>
                <input
                  required
                  type="email"
                  disabled={bookingSaving}
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none disabled:opacity-60"
                  style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
                />
              </div>
              <button
                type="submit"
                disabled={bookingSaving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.35)" }}
              >
                {bookingSaving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
                {bookingSaving ? "Processing…" : "Confirm Booking"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {confirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            data-testid="booking-confirmed"
            className="max-h-[min(92dvh,720px)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 sm:p-8"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#DCFCE7" }}>
                <CheckCircle2 size={44} color="#16A34A" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="mt-4 text-center text-xl" style={{ color: "#78350F", fontWeight: 800 }}>Booking Confirmed!</h2>
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500" style={{ fontWeight: 500 }}>Event:</span><span style={{ color: "#78350F", fontWeight: 700 }}>{confirmed.event}</span></div>
              <div className="flex justify-between"><span className="text-gray-500" style={{ fontWeight: 500 }}>Tier:</span><span style={{ color: "#78350F", fontWeight: 700 }}>{confirmed.tier}</span></div>
              <div className="flex justify-between"><span className="text-gray-500" style={{ fontWeight: 500 }}>Amount:</span><span style={{ color: "#78350F", fontWeight: 700 }}>{confirmed.amount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500" style={{ fontWeight: 500 }}>Booking ID:</span><span style={{ color: "#78350F", fontWeight: 700 }}>{confirmed.id}</span></div>
            </div>
            <div className="mt-6 flex justify-center">
              <div className="rounded-xl border-2 p-3" style={{ borderColor: "#16A34A" }} data-testid="booking-qr">
                <img src={confirmed.qrUrl} alt="Ticket QR" width={170} height={170} className="h-auto max-w-full" />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadTicket}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
                style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700 }}
              >
                <Download size={15} /> Download Ticket
              </button>
              <button
                type="button"
                onClick={() => { setConfirmed(null); navigate("/dashboard"); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm cursor-pointer hover:bg-amber-50 transition-all"
                style={{ border: "2px solid #D97706", color: "#D97706", fontWeight: 700 }}
              >
                <LayoutDashboard size={15} /> Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
