import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, CalendarDays, MapPin, Loader2, Ticket } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

type TierRow = {
  id: string;
  tier_name: string;
  price_cents: number;
  quantity: number;
  sold: number;
  listing_status: "On Sale" | "Sold Out" | "Paused";
};

type EventDetail = {
  id: string;
  name: string;
  event_date: string;
  location: string;
  status: "Active" | "Upcoming" | "Closed";
  ticket_tiers: TierRow[] | null;
};

export default function AttendeeEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [purchasingTierId, setPurchasingTierId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !eventId) return;
    const { data, error } = await supabase
      .from("events")
      .select("id,name,event_date,location,status,ticket_tiers(id,tier_name,price_cents,quantity,sold,listing_status)")
      .eq("id", eventId)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      setEvent(null);
      return;
    }
    setEvent((data ?? null) as EventDetail | null);
  }, [eventId]);

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

  useEffect(() => {
    if (profile?.full_name) setBuyerName(profile.full_name);
  }, [profile?.full_name]);

  const purchase = async (tierId: string) => {
    if (!user?.email || purchasingTierId || profile?.role !== "attendee") return;
    const name = buyerName.trim();
    if (!name) {
      toast.error("Enter your name for the ticket.");
      return;
    }
    setPurchasingTierId(tierId);
    const { error } = await supabase.rpc("purchase_tier_ticket", {
      p_tier_id: tierId,
      p_buyer_name: name,
      p_buyer_email: user.email,
    });
    setPurchasingTierId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket purchased! It appears on your dashboard.");
    await load();
  };

  const formatPrice = (cents: number) =>
    cents <= 0 ? "Free" : new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);

  if (!profile) return null;

  if (profile.role !== "attendee" && profile.role !== "admin") {
    return (
      <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
        Self-serve booking is for attendees. <Link to="/dashboard/events" className="underline" style={{ color: "#D97706" }}>Manage events</Link>
      </p>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Link
        to="/dashboard/explore"
        className="mb-6 inline-flex items-center gap-2 text-sm"
        style={{ color: "#D97706", fontWeight: 700 }}
      >
        <ArrowLeft size={16} aria-hidden /> Back to Explore
      </Link>

      {loading ? (
        <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading event…</p>
      ) : !event ? (
        <div className="rounded-2xl bg-white p-8 text-center" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
            Event not found or you do not have access. Subscribe to the organizer or use an invite link.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-2xl bg-white p-6" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
            <h1 className="text-xl sm:text-2xl" style={{ color: "#78350F", fontWeight: 800 }}>{event.name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} className="text-amber-400" />
                {event.event_date ? format(parseISO(event.event_date), "EEEE, MMM d, yyyy") : "—"}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} className="text-amber-400" />
                {event.location || "—"}
              </span>
            </div>
            <span
              className="mt-3 inline-block rounded-full px-3 py-1 text-xs"
              style={{
                fontWeight: 700,
                background: event.status === "Active" ? "#DCFCE7" : event.status === "Upcoming" ? "#FEF3C7" : "#F3F4F6",
                color: event.status === "Active" ? "#16A34A" : event.status === "Upcoming" ? "#D97706" : "#6B7280",
              }}
            >
              {event.status}
            </span>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm" style={{ color: "#78350F", fontWeight: 700 }}>Name on ticket</label>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full max-w-md rounded-xl border-2 px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
              placeholder="Your full name"
            />
            <p className="mt-1 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>Email used for purchase: {user?.email}</p>
          </div>

          <h2 className="mb-3 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Ticket types</h2>
          <ul className="space-y-3">
            {(event.ticket_tiers ?? []).map((t) => {
              const available = t.listing_status === "On Sale" && t.sold < t.quantity;
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "#FEF3C7" }}>
                      <Ticket size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>{t.tier_name}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                        {formatPrice(t.price_cents)} · {t.sold} / {t.quantity} sold · {t.listing_status}
                      </p>
                    </div>
                  </div>
                  {profile.role === "attendee" ? (
                    <button
                      type="button"
                      disabled={!available || purchasingTierId !== null}
                      onClick={() => void purchase(t.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm text-white transition-opacity disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700 }}
                    >
                      {purchasingTierId === t.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                      {purchasingTierId === t.id ? "Processing…" : available ? "Buy ticket" : "Unavailable"}
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: "#9CA3AF", fontWeight: 600 }}>Sign in as attendee to buy</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </motion.div>
  );
}
