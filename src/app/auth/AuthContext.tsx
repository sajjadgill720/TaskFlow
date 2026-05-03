import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import type { AppRole } from "../../lib/database.types";

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  phone: string | null;
  company: string | null;
  preferences: Record<string, unknown>;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    role: AppRole;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: {
  id: string;
  full_name: string;
  role: AppRole;
  phone: string | null;
  company: string | null;
  preferences: unknown;
}): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    role: row.role as AppRole,
    phone: row.phone,
    company: row.company,
    preferences: (row.preferences && typeof row.preferences === "object" ? row.preferences : {}) as Record<
      string,
      unknown
    >,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error || !data) {
      setProfile(null);
      return;
    }
    setProfile(mapProfile(data as Profile));
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) await loadProfile(uid);
  }, [loadProfile, session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) loadProfile(s.user.id).finally(() => mounted && setLoading(false));
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) void loadProfile(s.user.id);
      else setProfile(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local") };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName: string; role: AppRole }) => {
      if (!isSupabaseConfigured) {
        return { error: new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local") };
      }
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            role: input.role,
          },
        },
      });
      return { error: error ? new Error(error.message) : null };
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, loading, refreshProfile, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
