import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, Search, MapPin, CalendarDays, X, Sparkles, Loader2, Link2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { apiUrl } from "../../lib/apiBaseUrl";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

interface TicketTier {
  name: "Free" | "Paid" | "VIP";
  price: number;
  quantity: number;
  enabled: boolean;
}

interface EventItem {
  id: string;
  name: string;
  date: string;
  location: string;
  ticketsSold: number;
  totalTickets: number;
  status: "Active" | "Upcoming" | "Closed";
  price: string;
}

const defaultTiers: TicketTier[] = [
  { name: "Free", price: 0, quantity: 100, enabled: true },
  { name: "Paid", price: 25, quantity: 80, enabled: true },
  { name: "VIP", price: 75, quantity: 20, enabled: false },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: "#DCFCE7", text: "#16A34A" },
  Upcoming: { bg: "#FEF3C7", text: "#D97706" },
  Closed: { bg: "#F3F4F6", text: "#6B7280" },
};

function mapRows(rows: unknown[]): EventItem[] {
  return (rows as {
    id: string;
    name: string;
    event_date: string;
    location: string;
    status: EventItem["status"];
    ticket_tiers: { sold: number; quantity: number; price_cents: number; tier_name: string }[] | null;
  }[]).map((e) => {
    const tiers = e.ticket_tiers ?? [];
    const sold = tiers.reduce((s, t) => s + t.sold, 0);
    const cap = tiers.reduce((s, t) => s + t.quantity, 0);
    const paid = tiers.find((t) => t.price_cents > 0);
    const priceLabel = paid ? `${(paid.price_cents / 100).toFixed(0)}` : "Free";
    return {
      id: e.id,
      name: e.name,
      date: e.event_date ? format(parseISO(e.event_date), "MMM d, yyyy") : "—",
      location: e.location || "—",
      ticketsSold: sold,
      totalTickets: cap || 0,
      status: e.status,
      price: priceLabel === "Free" ? "Free" : `$${priceLabel}`,
    };
  });
}

export default function MyEventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: "", date: "", location: "", totalTickets: "", price: "" });
  const [tiers, setTiers] = useState<TicketTier[]>(defaultTiers);
  const [publishing, setPublishing] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const { data, error } = await supabase
      .from("events")
      .select("id,name,event_date,location,status,ticket_tiers(sold,quantity,price_cents,tier_name)")
      .order("event_date", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEvents(mapRows(data ?? []));
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

  const updateTier = (idx: number, patch: Partial<TicketTier>) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const filtered = events.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All" || e.status === filter;
    return matchSearch && matchFilter;
  });

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user || publishing) return;
    setPublishing(true);
    try {
    const enabledTiers = tiers.filter((t) => t.enabled);
    const totalFromTiers = enabledTiers.reduce((sum, t) => sum + t.quantity, 0);
    const totalTickets = totalFromTiers || Number(newEvent.totalTickets) || 100;

    const { data: created, error: evErr } = await supabase
      .from("events")
      .insert({
        organizer_id: user.id,
        name: newEvent.name,
        event_date: newEvent.date || new Date().toISOString().slice(0, 10),
        location: newEvent.location || "TBA",
        status: "Upcoming",
      })
      .select("id")
      .single();

    if (evErr || !created) {
      toast.error(evErr?.message ?? "Could not create event");
      return;
    }

    const tierRows = (enabledTiers.length ? enabledTiers : [{ name: "Free" as const, price: 0, quantity: totalTickets, enabled: true }]).map((t) => ({
      event_id: created.id,
      tier_name: t.name,
      price_cents: t.name === "Free" ? 0 : Math.max(0, Math.round(Number(t.price) * 100)),
      quantity: t.quantity,
      sold: 0,
      enabled: true,
      listing_status: "On Sale" as const,
    }));

    const { error: tierErr } = await supabase.from("ticket_tiers").insert(tierRows);
    if (tierErr) {
      toast.error(tierErr.message);
      return;
    }

    toast.success("Event published");
    setNewEvent({ name: "", date: "", location: "", totalTickets: "", price: "" });
    setTiers(defaultTiers);
    setShowModal(false);
    await load();
    } finally {
      setPublishing(false);
    }
  };

  const copyEventInviteLink = async (eventId: string) => {
    if (!isSupabaseConfigured || inviteBusyId) return;
    setInviteBusyId(eventId);
    try {
      const token =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 48)
          : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      const { error } = await supabase.from("event_invite_tokens").insert({ event_id: eventId, token });
      if (error) {
        toast.error(error.message);
        return;
      }
      const url = apiUrl(`/invite/${token}`);
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied. Attendees only see this event after they open it.");
    } finally {
      setInviteBusyId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-7 gap-4">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>My Events</h1>
          <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>Manage and track all your events</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}
        >
          <Plus size={16} /> Create Event
        </button>
      </div>

      {loading && (
        <p className="text-sm mb-4" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading events…</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-7">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
            style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
            onFocus={(e) => (e.target.style.borderColor = "#D97706")}
            onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl p-1 sm:gap-2" style={{ backgroundColor: "#FEF3C7" }}>
          {["All", "Active", "Upcoming", "Closed"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs transition-all sm:px-4 sm:text-sm"
              style={{
                fontWeight: 700,
                backgroundColor: filter === f ? "#D97706" : "transparent",
                color: filter === f ? "#fff" : "#92400E",
                boxShadow: filter === f ? "0 2px 8px rgba(217,119,6,0.3)" : "none",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl p-5 hover:scale-[1.02] transition-all cursor-default group"
            style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>{ev.name}</h3>
              <span
                className="px-3 py-1 rounded-full text-xs shrink-0"
                style={{ fontWeight: 700, backgroundColor: statusColors[ev.status].bg, color: statusColors[ev.status].text }}
              >
                {ev.status}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                <CalendarDays size={13} className="text-amber-400" /> {ev.date}
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                <MapPin size={13} className="text-amber-400" /> {ev.location}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: "#9CA3AF", fontWeight: 500 }}>
                <span style={{ color: "#78350F", fontWeight: 700 }}>{ev.ticketsSold}</span> / {ev.totalTickets || "—"} sold
              </span>
              <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "#FEF3C7", color: "#D97706", fontWeight: 800 }}>{ev.price}</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#FEF3C7" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: ev.totalTickets ? `${Math.min(100, (ev.ticketsSold / ev.totalTickets) * 100)}%` : "0%",
                  background: ev.totalTickets && ev.ticketsSold === ev.totalTickets ? "linear-gradient(135deg, #16A34A, #4ADE80)" : "linear-gradient(135deg, #D97706, #F59E0B)",
                }}
              />
            </div>
            <button
              type="button"
              disabled={inviteBusyId === ev.id}
              onClick={() => void copyEventInviteLink(ev.id)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-xs transition-colors disabled:opacity-50"
              style={{ borderColor: "#FDE68A", color: "#B45309", fontWeight: 700 }}
            >
              <Link2 size={14} aria-hidden />
              {inviteBusyId === ev.id ? "Creating link…" : "Copy attendee invite link (single event)"}
            </button>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16 text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
          <Sparkles size={32} className="mx-auto mb-3 text-amber-300" />
          No events found.
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[min(90dvh,720px)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 sm:p-7"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg" style={{ color: "#78350F", fontWeight: 800 }}>Create New Event</h2>
              <button
                type="button"
                disabled={publishing}
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-amber-50 hover:text-gray-600 disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: "Event Name", key: "name", type: "text", placeholder: "Enter event name" },
                { label: "Date", key: "date", type: "date", placeholder: "" },
                { label: "Location", key: "location", type: "text", placeholder: "Enter venue" },
                { label: "Total Capacity", key: "totalTickets", type: "number", placeholder: "e.g. 500" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>{f.label}</label>
                  <input
                    type={f.type}
                    required={f.key === "name"}
                    disabled={publishing}
                    value={(newEvent as Record<string, string>)[f.key]}
                    onChange={(e) => setNewEvent({ ...newEvent, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none transition-all disabled:opacity-60"
                    style={{ backgroundColor: "#FFFEF7", borderColor: "#FDE68A", fontWeight: 500 }}
                    onFocus={(e) => !publishing && (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Ticket Tiers</label>
                <div className="overflow-x-auto rounded-xl border-2" style={{ borderColor: "#FDE68A" }}>
                  <div className="min-w-[280px]">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2" style={{ background: "#FEF3C7" }}>
                    {["Tier", "Price (USD)", "Quantity", "On"].map((h) => (
                      <div key={h} className="text-xs" style={{ color: "#92400E", fontWeight: 800 }}>{h}</div>
                    ))}
                  </div>
                  {tiers.map((t, i) => (
                    <div key={t.name} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-t px-3 py-2" style={{ borderColor: "#FDE68A60" }}>
                      <div className="text-sm" style={{ color: "#78350F", fontWeight: 700 }}>{t.name}</div>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        disabled={publishing || t.name === "Free"}
                        value={t.name === "Free" ? 0 : t.price}
                        onChange={(e) => updateTier(i, { price: Number(e.target.value) })}
                        className="rounded-lg border px-2 py-1.5 text-xs outline-none disabled:bg-gray-50"
                        style={{ borderColor: "#FDE68A", fontWeight: 600 }}
                      />
                      <input
                        type="number"
                        min={0}
                        disabled={publishing}
                        value={t.quantity}
                        onChange={(e) => updateTier(i, { quantity: Number(e.target.value) })}
                        className="rounded-lg border px-2 py-1.5 text-xs outline-none disabled:opacity-60"
                        style={{ borderColor: "#FDE68A", fontWeight: 600 }}
                      />
                      <input
                        type="checkbox"
                        disabled={publishing}
                        checked={t.enabled}
                        onChange={(e) => updateTier(i, { enabled: e.target.checked })}
                        className="h-4 w-4 cursor-pointer accent-amber-500 disabled:cursor-not-allowed"
                      />
                    </div>
                  ))}
                  </div>
                </div>
                <p className="text-[10px] mt-1" style={{ color: "#9CA3AF", fontWeight: 500 }}>Paid/VIP prices are in dollars (stored as cents in the database).</p>
              </div>

              <button
                type="submit"
                data-testid="publish-event"
                disabled={publishing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.35)" }}
              >
                {publishing ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
                {publishing ? "Publishing…" : "Publish Event"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
