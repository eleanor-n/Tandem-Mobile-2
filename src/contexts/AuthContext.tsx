import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  onboardingCompleted: boolean | null;
  signOut: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  onboardingCompleted: null,
  signOut: async () => {},
  refreshOnboarding: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  const checkOnboarding = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle();

      // No profile row yet = new user, needs onboarding
      if (!data || error) {
        setOnboardingCompleted(false);
      } else {
        setOnboardingCompleted(data.onboarding_completed === true);
      }
    } catch {
      setOnboardingCompleted(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOnboarding = useCallback(async () => {
    if (user) await checkOnboarding(user.id);
  }, [user, checkOnboarding]);

  useEffect(() => {
    // Initial session — handles app launch with existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkOnboarding(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && event === "SIGNED_IN") {
        // New sign-in (email or Google OAuth) — determine correct screen
        setLoading(true);
        checkOnboarding(session.user.id);
      } else if (!session?.user) {
        // Signed out
        setOnboardingCompleted(null);
        setLoading(false);
      }
      // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, etc.
      // — session already handled by getSession() above; no need to re-check onboarding
    });

    return () => subscription.unsubscribe();
  }, [checkOnboarding]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setOnboardingCompleted(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, onboardingCompleted, signOut, refreshOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
