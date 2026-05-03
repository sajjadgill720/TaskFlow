import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, Ticket, Rocket, Star, Heart } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import type { AppRole } from "../../lib/database.types";

const roles = ["Attendee", "Organizer", "Admin"] as const;
const F = "Nunito, sans-serif";

function uiRoleToAppRole(r: (typeof roles)[number]): AppRole {
  if (r === "Attendee") return "attendee";
  if (r === "Organizer") return "organizer";
  return "admin";
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp, session, loading: authLoading } = useAuth();
  const [role, setRole] = useState<string>("Attendee");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, session, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const uiRole = roles.includes(role as (typeof roles)[number]) ? (role as (typeof roles)[number]) : "Attendee";
    const { error } = await signUp({
      email: form.email.trim(),
      password: form.password,
      fullName: form.name.trim(),
      role: uiRoleToAppRole(uiRole),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. If email confirmation is enabled, check your inbox before signing in.");
    navigate("/");
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const inputStyle = {
    backgroundColor: "#FFFEF7",
    borderColor: "#FDE68A",
    fontWeight: 500,
  };

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
        style={{ background: "linear-gradient(135deg, #92400E 0%, #B45309 40%, #D97706 100%)" }}
      >
        <div className="absolute top-[-100px] right-[-100px] w-72 h-72 rounded-full opacity-20" style={{ background: "#FCD34D" }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-96 h-96 rounded-full opacity-10" style={{ background: "#FDE68A" }} />
        <div className="absolute bottom-1/4 right-16 w-24 h-24 rounded-2xl rotate-12 opacity-10" style={{ background: "#fff" }} />

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 px-16 max-w-lg"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Rocket size={22} className="text-yellow-200" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Star size={18} className="text-yellow-200" />
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Heart size={18} className="text-yellow-200" />
            </div>
          </motion.div>

          <h1 className="text-white text-5xl mb-6" style={{ fontWeight: 900, lineHeight: 1.15 }}>
            Join the
            <br />
            <span style={{ color: "#FDE68A" }}>Future of</span>
            <br />
            Event Management.
          </h1>
          <p className="text-white/60 text-lg" style={{ fontWeight: 500 }}>
            Create your account and start today.
          </p>

          <div className="flex items-center gap-4 mt-10">
            {["Free to Start", "No Credit Card", "Instant Setup"].map((t) => (
              <div key={t} className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/80 text-xs" style={{ fontWeight: 600 }}>
                {t}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative" style={{ backgroundColor: "#FFFDF7" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#D97706 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-white rounded-3xl p-10" style={{ boxShadow: "0 4px 40px rgba(120,53,15,0.08), 0 1px 3px rgba(0,0,0,0.05)" }}>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)" }}>
                <Ticket size={20} className="text-white" />
              </div>
              <span className="text-2xl" style={{ color: "#78350F", fontWeight: 900 }}>TicketFlow</span>
            </div>

            <h3 className="text-center text-xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>
              Create Account
            </h3>
            <p className="text-center text-sm mb-7" style={{ color: "#9CA3AF", fontWeight: 500 }}>
              Choose your role — it controls dashboard access
            </p>

            <div className="flex rounded-2xl p-1.5 mb-7" style={{ backgroundColor: "#FEF3C7" }}>
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="flex-1 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                  style={{
                    fontWeight: 700,
                    backgroundColor: role === r ? "#D97706" : "transparent",
                    color: role === r ? "#fff" : "#92400E",
                    boxShadow: role === r ? "0 2px 8px rgba(217,119,6,0.35)" : "none",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              {[
                { label: "Full Name", field: "name", type: "text", placeholder: "Ahmed Omar" },
                { label: "Email Address", field: "email", type: "email", placeholder: "you@example.com" },
              ].map((f) => (
                <div key={f.field}>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>{f.label}</label>
                  <input
                    type={f.type}
                    required
                    value={(form as Record<string, string>)[f.field]}
                    onChange={update(f.field)}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                  />
                </div>
              ))}

              {[
                { label: "Password", field: "password", show: showPassword, toggle: () => setShowPassword(!showPassword) },
                { label: "Confirm Password", field: "confirm", show: showConfirm, toggle: () => setShowConfirm(!showConfirm) },
              ].map((f) => (
                <div key={f.field}>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>{f.label}</label>
                  <div className="relative">
                    <input
                      type={f.show ? "text" : "password"}
                      required
                      minLength={6}
                      value={(form as Record<string, string>)[f.field]}
                      onChange={update(f.field)}
                      placeholder="Enter password"
                      className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all pr-11"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "#D97706")}
                      onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                    />
                    <button type="button" onClick={f.toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 cursor-pointer">
                      {f.show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl text-white text-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 700, boxShadow: "0 4px 15px rgba(217,119,6,0.35)" }}
              >
                {submitting ? "Creating account…" : "Sign Up"}
              </button>
            </form>

            <div className="flex items-center my-7">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #FDE68A, transparent)" }} />
              <span className="px-4 text-xs" style={{ color: "#B45309", fontWeight: 600 }}>or</span>
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #FDE68A, transparent)" }} />
            </div>

            <p className="text-center text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>
              Already have an account?{" "}
              <Link to="/" className="hover:underline" style={{ color: "#D97706", fontWeight: 700 }}>
                Login
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
