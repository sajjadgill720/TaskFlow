import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Save, User, Bell, Shield, Palette, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../auth/AuthContext";

const tabs = [
  { icon: User, label: "Profile" },
  { icon: Bell, label: "Notifications" },
  { icon: Shield, label: "Security" },
  { icon: Palette, label: "Appearance" },
];

type NotifPrefs = { email: boolean; push: boolean; sms: boolean; marketing: boolean };

function readNotifs(prefs: Record<string, unknown> | undefined): NotifPrefs {
  const n = prefs?.notifications;
  if (n && typeof n === "object" && n !== null) {
    const o = n as Record<string, boolean>;
    return {
      email: Boolean(o.email ?? true),
      push: Boolean(o.push ?? true),
      sms: Boolean(o.sms ?? false),
      marketing: Boolean(o.marketing ?? false),
    };
  }
  return { email: true, push: true, sms: false, marketing: false };
}

export default function SettingsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("Profile");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", company: "" });
  const [notifs, setNotifs] = useState<NotifPrefs>({ email: true, push: true, sms: false, marketing: false });

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      name: profile.full_name,
      phone: profile.phone ?? "",
      company: profile.company ?? "",
    });
    setNotifs(readNotifs(profile.preferences));
  }, [profile]);

  const inputStyle = {
    backgroundColor: "#FFFEF7",
    borderColor: "#FDE68A",
    fontWeight: 500 as const,
  };

  const handleSave = async () => {
    if (!user || !profile || !isSupabaseConfigured) {
      toast.error("Not signed in or Supabase not configured.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const preferences = {
        ...(profile.preferences ?? {}),
        notifications: notifs,
      };
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.name.trim(),
          phone: profileForm.phone.trim() || null,
          company: profileForm.company.trim() || null,
          preferences,
        })
        .eq("id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await refreshProfile();
      setSaved(true);
      toast.success("Settings saved");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const displayEmail = user?.email ?? "—";
  const av =
    profileForm.name.trim().length >= 2
      ? profileForm.name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : displayEmail.slice(0, 2).toUpperCase();

  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "…";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h1 className="text-2xl mb-1" style={{ color: "#78350F", fontWeight: 800 }}>Settings</h1>
      <p className="text-sm mb-7" style={{ color: "#9CA3AF", fontWeight: 500 }}>Manage your account preferences</p>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[220px] flex lg:flex-col gap-1 overflow-x-auto p-1.5 rounded-2xl" style={{ backgroundColor: "#FEF3C7" }}>
          {tabs.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setActiveTab(t.label)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm whitespace-nowrap cursor-pointer transition-all text-left"
              style={{
                fontWeight: activeTab === t.label ? 700 : 600,
                backgroundColor: activeTab === t.label ? "#D97706" : "transparent",
                color: activeTab === t.label ? "#fff" : "#92400E",
                boxShadow: activeTab === t.label ? "0 2px 8px rgba(217,119,6,0.3)" : "none",
              }}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-2xl bg-white p-5 sm:p-7" style={{ boxShadow: "0 2px 20px rgba(120,53,15,0.06)" }}>
          {activeTab === "Profile" && (
            <div className="space-y-6">
              <h2 className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Profile Information</h2>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg" style={{ background: "linear-gradient(135deg, #D97706, #F59E0B)", fontWeight: 800, boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}>
                  {av}
                </div>
                <div>
                  <p className="text-sm" style={{ color: "#78350F", fontWeight: 700 }}>{profileForm.name || displayEmail}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>{roleLabel} account</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Full Name</label>
                  <input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Email Address</label>
                  <input
                    value={displayEmail}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none bg-gray-50 text-gray-500"
                    style={{ borderColor: "#E5E7EB", fontWeight: 500 }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "#9CA3AF", fontWeight: 500 }}>Email is managed in Supabase Auth.</p>
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Phone Number</label>
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>Company</label>
                  <input
                    value={profileForm.company}
                    onChange={(e) => setProfileForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#D97706")}
                    onBlur={(e) => (e.target.style.borderColor = "#FDE68A")}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "Notifications" && (
            <div className="space-y-5">
              <h2 className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Notification Preferences</h2>
              {([
                ["Email Notifications", "Receive updates via email", "email"],
                ["Push Notifications", "Browser push notifications", "push"],
                ["SMS Alerts", "Receive text messages", "sms"],
                ["Marketing Emails", "Product news and tips", "marketing"],
              ] as const).map(([label, desc, key]) => (
                <div key={key} className="flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "#FDE68A30" }}>
                  <div className="min-w-0 pr-2">
                    <p className="text-sm" style={{ color: "#78350F", fontWeight: 700 }}>{label}</p>
                    <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifs({ ...notifs, [key]: !notifs[key] })}
                    className="w-12 h-7 rounded-full relative cursor-pointer transition-all"
                    style={{
                      background: notifs[key] ? "linear-gradient(135deg, #D97706, #F59E0B)" : "#E5E7EB",
                      boxShadow: notifs[key] ? "0 2px 8px rgba(217,119,6,0.3)" : "none",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all flex items-center justify-center"
                      style={{ left: notifs[key] ? 22 : 2 }}
                    >
                      {notifs[key] && <Check size={10} className="text-amber-500" />}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Security" && (
            <div className="space-y-5">
              <h2 className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Security Settings</h2>
              <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>
                Password changes and MFA are handled in the Supabase Auth UI or your hosted account settings.
              </p>
              {["Current Password", "New Password", "Confirm New Password"].map((label) => (
                <div key={label}>
                  <label className="block text-sm mb-2" style={{ color: "#78350F", fontWeight: 700 }}>{label}</label>
                  <input
                    type="password"
                    placeholder="Use Supabase dashboard or auth flow"
                    disabled
                    className="w-full max-w-md px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all opacity-60"
                    style={inputStyle}
                  />
                </div>
              ))}
              <div className="mt-2 flex flex-col gap-3 border-t py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "#FDE68A30" }}>
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: "#78350F", fontWeight: 700 }}>Two-Factor Authentication</p>
                  <p className="text-xs" style={{ color: "#9CA3AF", fontWeight: 500 }}>Configure in Supabase / your identity provider</p>
                </div>
                <span className="w-fit shrink-0 rounded-full px-4 py-1.5 text-xs" style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", color: "#D97706", fontWeight: 700 }}>See docs</span>
              </div>
            </div>
          )}

          {activeTab === "Appearance" && (
            <div className="space-y-5">
              <h2 className="text-sm" style={{ color: "#78350F", fontWeight: 800 }}>Appearance</h2>
              <p className="text-sm" style={{ color: "#9CA3AF", fontWeight: 500 }}>Choose your preferred theme</p>
              <div className="flex flex-wrap gap-4 sm:gap-5">
                {[
                  { label: "Light", bg: "#FFFDF7", active: true },
                  { label: "Dark", bg: "#1F2937", active: false },
                  { label: "System", bg: "linear-gradient(135deg, #FFFDF7 50%, #1F2937 50%)", active: false },
                ].map((t) => (
                  <div key={t.label} className="group cursor-pointer text-center">
                    <div
                      className="w-24 h-16 rounded-xl border-2 mb-2 transition-all group-hover:scale-105"
                      style={{
                        background: t.bg,
                        borderColor: t.active ? "#D97706" : "#E5E7EB",
                        boxShadow: t.active ? "0 2px 10px rgba(217,119,6,0.2)" : "none",
                      }}
                    />
                    <p className="text-xs" style={{ color: t.active ? "#78350F" : "#9CA3AF", fontWeight: 700 }}>{t.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t" style={{ borderColor: "#FDE68A30" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
              style={{
                background: saved ? "linear-gradient(135deg, #16A34A, #4ADE80)" : "linear-gradient(135deg, #D97706, #F59E0B)",
                fontWeight: 700,
                boxShadow: saved ? "0 4px 15px rgba(22,163,74,0.3)" : "0 4px 15px rgba(217,119,6,0.3)",
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
