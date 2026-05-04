import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";
import { AlertCircle, Eye, EyeOff, Loader2, Sparkles, Ticket, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../auth/AuthContext";

const F = "Nunito, sans-serif";

function safeAppPath(path: string | null | undefined, fallback: string): string {
  const p = path?.trim();
  if (!p || !p.startsWith("/") || p.startsWith("//")) return fallback;
  return p;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postAuthPath = safeAppPath(searchParams.get("redirect"), "/dashboard");
  const isInviteReturn = postAuthPath.startsWith("/invite/");
  const { signIn, session, loading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate(postAuthPath, { replace: true });
    }
  }, [authLoading, session, navigate, postAuthPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err.message);
        return;
      }
      navigate(postAuthPath);
    } finally {
      setSubmitting(false);
    }
  };

  const errorBorder = error ? "#DC2626" : "#FDE68A";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: F, background: "#FFFDF7" }}>
        <p style={{ color: "#92400E", fontWeight: 700 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ fontFamily: F }}>
      <div
        className="hidden lg:flex flex-col justify-center items-center w-1/2 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #78350F 0%, #B45309 40%, #D97706 100%)" }}
      >
        <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full opacity-20" style={{ background: "#FCD34D" }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-80 h-80 rounded-full opacity-15" style={{ background: "#FDE68A" }} />
        <div className="absolute top-1/3 right-10 w-32 h-32 rounded-3xl rotate-45 opacity-10" style={{ background: "#fff" }} />

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 px-16 max-w-lg"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Ticket size={24} className="text-yellow-200" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Sparkles size={18} className="text-yellow-200" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Zap size={20} className="text-yellow-200" />
            </div>
          </motion.div>

          <h1 className="text-white text-5xl mb-6" style={{ fontWeight: 900, lineHeight: 1.15 }}>
            Manage Events.
            <br />
            <span style={{ color: "#FDE68A" }}>Sell Tickets.</span>
            <br />
            Validate Instantly.
          </h1>
          <p className="text-white/60 text-lg" style={{ fontWeight: 500 }}>
            Your all-in-one event platform powered by simplicity.
          </p>

          <div className="flex items-center gap-4 mt-10">
            {["10K+ Events", "50K+ Users", "99.9% Uptime"].map((t) => (
              <div key={t} className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/80 text-xs" style={{ fontWeight: 600 }}>
                {t}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-4 sm:p-8" style={{ backgroundColor: "#FFFDF7" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#D97706 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="rounded-3xl bg-white p-6 sm:p-10" style={{ boxShadow: "0 4px 40px rgba(120,53,15,0.08), 0 1px 3px rgba(0,0,0,0.05)" }}>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
                <Ticket size={20} className="text-white" />
              </div>
              <span className="text-2xl" style={{ color: "#78350F", fontWeight: 900 }}>TicketFlow</span>
            </div>

            <h3 className="text-center text-xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>
              Welcome Back!
            </h3>
            <p className="text-center text-sm mb-7" style={{ color: "#9CA3AF", fontWeight: 500 }}>
              Sign in with your Supabase account. Your role is set at signup.
            </p>

            {isInviteReturn && (
              <div
                className="mb-6 rounded-2xl border-2 px-4 py-3 text-center text-xs"
                style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#78350F", fontWeight: 600 }}
              >
                You&apos;re finishing an event invite. After sign in, your invite will be accepted automatically (attendee accounts only).
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                  style={{ backgroundColor: "#FFFEF7", borderColor: errorBorder, fontWeight: 500 }}
                  onFocus={(e) => !error && (e.target.style.borderColor = "#D97706")}
                  onBlur={(e) => (e.target.style.borderColor = errorBorder)}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all pr-11"
                    style={{ backgroundColor: "#FFFEF7", borderColor: errorBorder, fontWeight: 500 }}
                    onFocus={(e) => !error && (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = errorBorder)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-testid="login-error"
                  className="flex items-start gap-2 p-3 rounded-xl"
                  style={{ background: "#FEE2E2", border: "1px solid #FCA5A5" }}
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" color="#DC2626" />
                  <span className="text-xs" style={{ color: "#991B1B", fontWeight: 600 }}>{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.35)" }}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
                {submitting ? "Signing in…" : "Login"}
              </button>
            </form>

            <div className="flex items-center my-7">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #FDE68A, transparent)" }} />
              <span className="px-4 text-xs" style={{ color: "#B45309", fontWeight: 600 }}>or</span>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #FDE68A, transparent)" }} />
            </div>

            <p className="text-center text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>
              Don&apos;t have an account?{" "}
              <Link
                to={searchParams.get("redirect") ? `/signup?redirect=${encodeURIComponent(searchParams.get("redirect")!)}` : "/signup"}
                className="hover:underline"
                style={{ color: "#D97706", fontWeight: 700 }}
              >
                Sign Up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
