import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Compass, UserPlus, UserMinus, CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

type OrganizerRow = { id: string; full_name: string; company: string | null };
type EventRow = {
  id: string;
  name: string;
  event_date: string;
  location: string;
  status: "Active" | "Upcoming" | "Closed";
  organizer_id: string;
};

export default function ExplorePage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [subs, setSubs] = useState<{ organizer_id: string }[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [subBusy, setSubBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const [{ data: orgData, error: orgErr }, { data: subData, error: subErr }, { data: evData, error: evErr }] =
      await Promise.all([
        supabase.rpc("list_organizers_for_discovery"),
        supabase.from("organizer_subscriptions").select("organizer_id").eq("subscriber_id", user.id),
        supabase
          .from("events")
          .select("id,name,event_date,location,status,organizer_id")
          .order("event_date", { ascending: true }),
      ]);
    if (orgErr) toast.error(orgErr.message);
    if (subErr) toast.error(subErr.message);
    if (evErr) toast.error(evErr.message);
    setOrganizers((orgData ?? []) as OrganizerRow[]);
    setSubs((subData ?? []) as { organizer_id: string }[]);
    setEvents((evData ?? []) as EventRow[]);
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

  const subscribedIds = new Set(subs.map((s) => s.organizer_id));

  const subscribe = async (organizerId: string) => {
    if (!user || profile?.role !== "attendee" || subBusy) return;
    setSubBusy(organizerId);
    const { error } = await supabase.from("organizer_subscriptions").insert({
      subscriber_id: user.id,
      organizer_id: organizerId,
    });
    setSubBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subscribed — you can see all events from this organizer.");
    await load();
  };

  const unsubscribe = async (organizerId: string) => {
    if (!user || subBusy) return;
    setSubBusy(organizerId);
    const { error } = await supabase
      .from("organizer_subscriptions")
      .delete()
      .eq("subscriber_id", user.id)
      .eq("organizer_id", organizerId);
    setSubBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unsubscribed.");
    await load();
  };

  if (!profile) return null;

  if (profile.role !== "attendee" && profile.role !== "admin") {
    return (
      <div className="rounded-2xl bg-white p-8 text-center" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
        <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>
          Explore is for attendees. Use My Events to manage your own listings.
        </p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="mb-8 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
          <Compass size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl" style={{ color: "#78350F", fontWeight: 800 }}>Explore</h1>
          <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>
            Subscribe to organizers to see all of their events, or open an invite link to unlock a single event only.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 600 }}>Loading…</p>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="mb-4 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Organizers you follow</h2>
            {subs.length === 0 ? (
              <p className="rounded-2xl bg-white p-6 text-sm" style={{ color: "#9CA3AF", fontWeight: 500, boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
                You are not subscribed yet. Pick an organizer below to see every event they publish.
              </p>
            ) : (
              <ul className="space-y-2">
                {subs.map((s) => {
                  const o = organizers.find((x) => x.id === s.organizer_id);
                  return (
                    <li
                      key={s.organizer_id}
                      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3"
                      style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
                    >
                      <span className="text-sm" style={{ color: "#78350F", fontWeight: 700 }}>{o?.full_name ?? s.organizer_id}</span>
                      <button
                        type="button"
                        disabled={subBusy === s.organizer_id}
                        onClick={() => void unsubscribe(s.organizer_id)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                        style={{ color: "#B45309", fontWeight: 700, background: "#FEF3C7" }}
                      >
                        <UserMinus size={14} aria-hidden /> Unsubscribe
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-10">
            <h2 className="mb-4 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Discover organizers</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {organizers
                .filter((o) => o.id !== user?.id)
                .map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-4"
                    style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-sm" style={{ color: "#78350F", fontWeight: 800 }}>{o.full_name}</p>
                      {o.company ? <p className="truncate text-xs text-gray-500">{o.company}</p> : null}
                    </div>
                    {subscribedIds.has(o.id) ? (
                      <span className="shrink-0 text-xs" style={{ color: "#16A34A", fontWeight: 700 }}>Following</span>
                    ) : (
                      <button
                        type="button"
                        disabled={profile.role !== "attendee" || subBusy === o.id}
                        onClick={() => void subscribe(o.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs text-white transition-opacity disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700 }}
                      >
                        <UserPlus size={14} aria-hidden /> Subscribe
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Events you can book</h2>
            {events.length === 0 ? (
              <p className="rounded-2xl bg-white p-6 text-sm" style={{ color: "#9CA3AF", fontWeight: 500, boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
                No events visible yet. Subscribe to an organizer or redeem an invite link from your organizer.
              </p>
            ) : (
              <ul className="space-y-3">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <Link
                      to={`/dashboard/explore/event/${ev.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 transition-colors hover:bg-amber-50/40"
                      style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>{ev.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={12} className="text-amber-400" />
                            {ev.event_date ? format(parseISO(ev.event_date), "MMM d, yyyy") : "—"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-amber-400" />
                            {ev.location || "—"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="shrink-0 text-amber-400" size={20} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </motion.div>
  );
}
