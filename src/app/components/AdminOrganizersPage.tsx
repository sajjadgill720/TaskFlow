import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building2, ChevronDown, MapPin, Search, Ticket } from "lucide-react";
import { Link } from "react-router";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import type { AppRole } from "../../lib/database.types";

type OrgProfile = {
  id: string;
  full_name: string;
  role: AppRole;
  company: string | null;
};

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  location: string;
  status: "Active" | "Upcoming" | "Closed";
  organizer_id: string;
  ticket_tiers: { sold: number; quantity: number; price_cents: number; tier_name: string }[] | null;
};

const statusColors: Record<string, { bg: string; text: string }> = {
  Active: { bg: "#DCFCE7", text: "#16A34A" },
  Upcoming: { bg: "#FEF3C7", text: "#D97706" },
  Closed: { bg: "#F3F4F6", text: "#6B7280" },
};

function eventSoldTotal(ev: EventRow) {
  const tiers = ev.ticket_tiers ?? [];
  const sold = tiers.reduce((s, t) => s + t.sold, 0);
  const cap = tiers.reduce((s, t) => s + t.quantity, 0);
  return { sold, cap };
}

export default function AdminOrganizersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState<OrgProfile[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;

    const [{ data: orgRows, error: orgErr }, { data: evRows, error: evErr }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,role,company").eq("role", "organizer").order("full_name"),
      supabase
        .from("events")
        .select("id,name,event_date,location,status,organizer_id,ticket_tiers(sold,quantity,price_cents,tier_name)")
        .order("event_date", { ascending: false }),
    ]);

    if (orgErr) {
      toast.error(orgErr.message);
      return;
    }
    if (evErr) {
      toast.error(evErr.message);
      return;
    }

    const evs = (evRows ?? []) as EventRow[];
    const orgList = (orgRows ?? []) as OrgProfile[];
    const orgIdsFromEvents = new Set(evs.map((e) => e.organizer_id));
    const missing = [...orgIdsFromEvents].filter((id) => !orgList.some((o) => o.id === id));

    let extra: OrgProfile[] = [];
    if (missing.length) {
      const { data: extraRows, error: exErr } = await supabase
        .from("profiles")
        .select("id,full_name,role,company")
        .in("id", missing);
      if (exErr) {
        toast.error(exErr.message);
        return;
      }
      extra = (extraRows ?? []) as OrgProfile[];
    }

    const merged = new Map<string, OrgProfile>();
    for (const o of [...orgList, ...extra]) merged.set(o.id, o);
    const sorted = [...merged.values()].sort((a, b) =>
      (a.full_name || "").localeCompare(b.full_name || "", undefined, { sensitivity: "base" })
    );

    setOrganizers(sorted);
    setEvents(evs);
    setOpenIds(new Set(sorted.map((o) => o.id)));
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

  const eventsByOrganizer = useMemo(() => {
    const m = new Map<string, EventRow[]>();
    for (const e of events) {
      const list = m.get(e.organizer_id) ?? [];
      list.push(e);
      m.set(e.organizer_id, list);
    }
    return m;
  }, [events]);

  const filteredOrganizers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizers;
    return organizers.filter((o) => {
      const hay = `${o.full_name} ${o.company ?? ""} ${o.id}`.toLowerCase();
      if (hay.includes(q)) return true;
      const theirs = eventsByOrganizer.get(o.id) ?? [];
      return theirs.some((ev) => ev.name.toLowerCase().includes(q) || ev.location.toLowerCase().includes(q));
    });
  }, [organizers, search, eventsByOrganizer]);

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl" style={{ color: "#78350F", fontWeight: 800 }}>
            Organizers &amp; events
          </h1>
          <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>
            Full directory of organizer accounts and every event on the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "#78350F", fontWeight: 600 }}>
          <span className="rounded-full px-3 py-1" style={{ backgroundColor: "#FEF3C7" }}>
            {organizers.length} organizers
          </span>
          <span className="rounded-full px-3 py-1" style={{ backgroundColor: "#E0F2FE" }}>
            {events.length} events
          </span>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by organizer, company, event, or location…"
          className="w-full rounded-xl border border-amber-100 py-3 pl-11 pr-4 text-sm outline-none focus:border-amber-300"
          style={{ backgroundColor: "#FFFBEB", fontWeight: 500, color: "#78350F" }}
        />
      </div>

      {loading && (
        <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
          Loading…
        </p>
      )}

      {!loading && filteredOrganizers.length === 0 && (
        <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
          No organizers match your search.
        </p>
      )}

      <div className="space-y-3">
        {filteredOrganizers.map((org) => {
          const orgEvents = eventsByOrganizer.get(org.id) ?? [];
          const expanded = openIds.has(org.id);
          return (
            <div
              key={org.id}
              className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm"
              style={{ boxShadow: "0 4px 24px rgba(120,53,15,0.06)" }}
            >
              <button
                type="button"
                onClick={() => toggleOpen(org.id)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-amber-50/50 sm:items-center sm:gap-4 sm:p-5"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white sm:h-12 sm:w-12"
                  style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}
                >
                  <Building2 size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base sm:text-lg" style={{ color: "#78350F", fontWeight: 800 }}>
                      {org.full_name || "Unnamed organizer"}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                      style={{
                        fontWeight: 700,
                        backgroundColor: org.role === "organizer" ? "#DCFCE7" : "#F3E8FF",
                        color: org.role === "organizer" ? "#16A34A" : "#7C3AED",
                      }}
                    >
                      {org.role}
                    </span>
                  </div>
                  {org.company ? (
                    <p className="mt-0.5 truncate text-xs text-gray-500" style={{ fontWeight: 500 }}>
                      {org.company}
                    </p>
                  ) : null}
                  <p className="mt-1 font-mono text-[10px] text-gray-400 break-all sm:text-xs">ID {org.id}</p>
                  <p className="mt-2 text-xs sm:hidden" style={{ color: "#B45309", fontWeight: 600 }}>
                    {orgEvents.length} event{orgEvents.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <span className="hidden rounded-full px-3 py-1 text-xs sm:inline-block" style={{ backgroundColor: "#FFFBEB", color: "#78350F", fontWeight: 700 }}>
                    {orgEvents.length} event{orgEvents.length === 1 ? "" : "s"}
                  </span>
                  <ChevronDown
                    size={22}
                    className="text-amber-700 transition-transform"
                    style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    aria-hidden
                  />
                </div>
              </button>

              {expanded && (
                <div className="border-t border-amber-50 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                  {orgEvents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500" style={{ fontWeight: 500 }}>
                      No events yet for this organizer.
                    </p>
                  ) : (
                    <>
                      <div className="hidden md:block overflow-x-auto rounded-xl border border-amber-50">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead>
                            <tr style={{ backgroundColor: "#FFFBEB" }}>
                              {["Event", "Date", "Location", "Status", "Tickets"].map((h) => (
                                <th key={h} className="px-4 py-3 text-xs" style={{ fontWeight: 700, color: "#B45309" }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {orgEvents.map((ev) => {
                              const { sold, cap } = eventSoldTotal(ev);
                              const st = statusColors[ev.status] ?? statusColors.Upcoming;
                              return (
                                <tr key={ev.id} className="border-t border-amber-50">
                                  <td className="px-4 py-3" style={{ fontWeight: 700, color: "#78350F" }}>
                                    {ev.name}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                    {ev.event_date ? format(parseISO(ev.event_date), "MMM d, yyyy") : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{ev.location || "—"}</td>
                                  <td className="px-4 py-3">
                                    <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ fontWeight: 700, ...st }}>
                                      {ev.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                    {sold} / {cap || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-3 md:hidden">
                        {orgEvents.map((ev) => {
                          const { sold, cap } = eventSoldTotal(ev);
                          const st = statusColors[ev.status] ?? statusColors.Upcoming;
                          return (
                            <div key={ev.id} className="rounded-xl border border-amber-50 bg-[#FFFDF7] p-4">
                              <div className="flex items-start justify-between gap-2">
                                <p style={{ fontWeight: 800, color: "#78350F" }}>{ev.name}</p>
                                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ fontWeight: 700, ...st }}>
                                  {ev.status}
                                </span>
                              </div>
                              <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                                <Ticket size={14} className="text-amber-500 shrink-0" aria-hidden />
                                {sold} / {cap || "—"} sold
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {ev.event_date ? format(parseISO(ev.event_date), "MMM d, yyyy") : "—"}
                              </p>
                              <p className="mt-1 flex items-start gap-1 text-xs text-gray-600">
                                <MapPin size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
                                {ev.location || "—"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-gray-400" style={{ fontWeight: 500 }}>
        Manage ticketing from{" "}
        <Link to="/dashboard/events" className="font-semibold text-amber-700 underline-offset-2 hover:underline">
          My Events
        </Link>
        ,{" "}
        <Link to="/dashboard/sell-tickets" className="font-semibold text-amber-700 underline-offset-2 hover:underline">
          Sell Tickets
        </Link>
        , or{" "}
        <Link to="/dashboard/analytics" className="font-semibold text-amber-700 underline-offset-2 hover:underline">
          Analytics
        </Link>
        .
      </p>
    </motion.div>
  );
}
