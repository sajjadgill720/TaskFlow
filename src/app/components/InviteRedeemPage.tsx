import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { Ticket, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

const F = "Nunito, sans-serif";

/** Path to return to after login/signup (token is URL-safe from our generator). */
function inviteRedirectTarget(token: string) {
  return `/invite/${token.trim()}`;
}

export default function InviteRedeemPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();
  const [working, setWorking] = useState(false);

  const rawToken = token?.trim() ?? "";
  const inviteTarget = rawToken ? inviteRedirectTarget(rawToken) : "/";
  const loginHref = rawToken ? `/?redirect=${encodeURIComponent(inviteTarget)}` : "/";
  const signupHref = rawToken ? `/signup?redirect=${encodeURIComponent(inviteTarget)}` : "/signup";

  useEffect(() => {
    if (authLoading || !rawToken) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured.");
      return;
    }
    if (!session) return;
    if (!profile) return;
    if (profile.role !== "attendee") {
      toast.error("Only attendee accounts can use event invite links.");
      navigate("/dashboard", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      setWorking(true);
      const { data, error } = await supabase.rpc("redeem_event_invite", { p_token: rawToken });
      setWorking(false);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        navigate("/dashboard/explore", { replace: true });
        return;
      }
      const eventId = data as string;
      toast.success("Invite accepted — you can view and book this event.");
      navigate(`/dashboard/explore/event/${eventId}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session, profile, rawToken, navigate]);

  if (!rawToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6" style={{ fontFamily: F, background: "#FFFDF7" }}>
        <p className="text-sm" style={{ color: "#92400E", fontWeight: 600 }}>Invalid invite link.</p>
        <Link to="/" className="mt-3 text-sm underline" style={{ color: "#D97706", fontWeight: 700 }}>Home</Link>
      </div>
    );
  }

  if (!authLoading && !isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6" style={{ fontFamily: F, background: "#FFFDF7" }}>
        <p className="text-sm" style={{ color: "#92400E", fontWeight: 600 }}>Supabase is not configured.</p>
      </div>
    );
  }

  /* Signed out: choose login or signup — both preserve redirect so invite redeems after auth */
  if (!authLoading && !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6" style={{ fontFamily: F, background: "#FFFDF7" }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
          <Ticket className="text-white" size={28} />
        </div>
        <div className="max-w-md text-center">
          <h1 className="text-xl sm:text-2xl" style={{ color: "#78350F", fontWeight: 800 }}>You&apos;re invited to an event</h1>
          <p className="mt-2 text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>
            Sign in if you already have an account, or create a free attendee account. After you&apos;re signed in, we&apos;ll accept the invite automatically.
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to={loginHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm text-white sm:flex-none"
            style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.35)" }}
          >
            <LogIn size={18} aria-hidden />
            Sign in
          </Link>
          <Link
            to={signupHref}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-5 py-3 text-sm sm:flex-none"
            style={{ borderColor: "#D97706", color: "#D97706", fontWeight: 700 }}
          >
            <UserPlus size={18} aria-hidden />
            Create account
          </Link>
        </div>
        <p className="max-w-md text-center text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
          New accounts must be <strong style={{ color: "#78350F" }}>Attendee</strong> to accept this invite. If email confirmation is on, confirm your email then sign in — you&apos;ll return to this invite.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6" style={{ fontFamily: F, background: "#FFFDF7" }}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
        <Ticket className="text-white" size={28} />
      </div>
      <p className="text-center text-sm" style={{ color: "#92400E", fontWeight: 700 }}>
        {authLoading || (session && !profile) ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            Loading…
          </span>
        ) : working ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            Accepting your invite…
          </span>
        ) : (
          "Redirecting…"
        )}
      </p>
      <Link to="/dashboard/explore" className="text-xs underline" style={{ color: "#D97706", fontWeight: 600 }}>
        Go to Explore
      </Link>
    </div>
  );
}
