import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, handleSupabaseError } from "../lib/supabase";
import { logError } from "../lib/errorLogger";
import { registerForPushNotifications } from "../lib/notifications";
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
    const timeout = setTimeout(() => {
      setOnboardingCompleted(prev => prev === null ? false : prev);
      setLoading(false);
    }, 5000);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("[Auth] checkOnboarding result:", data?.onboarding_completed, "for user:", userId);

      // No profile row yet = new user, needs onboarding
      if (!data) {
        setOnboardingCompleted(false);
      } else if (error) {
        setOnboardingCompleted(false);
      } else {
        setOnboardingCompleted(data.onboarding_completed === true);
      }
    } catch (err: any) {
      logError(err, { screen: "AuthContext", action: "checkOnboarding" });
      setOnboardingCompleted(false);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  const refreshOnboarding = useCallback(async () => {
    if (user) await checkOnboarding(user.id);
  }, [user, checkOnboarding]);

  useEffect(() => {
    // Initial session — handles app launch with existing session
    const sessionTimeout = setTimeout(() => {
      // Safety valve: if getSession hangs (e.g. AsyncStorage delay), unblock the UI
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      clearTimeout(sessionTimeout);
      if (error) {
        // Stale or invalid token — sign out via SDK (clears its own storage) and reset state
        await handleSupabaseError(error);
        setSession(null);
        setUser(null);
        setOnboardingCompleted(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkOnboarding(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && event === "SIGNED_IN") {
        // All auth methods (email, Google, Apple, phone OTP) — determine correct screen
        setLoading(true);
        checkOnboarding(session.user.id);
        registerForPushNotifications().catch(() => {}); // non-blocking
      } else if (event === "SIGNED_OUT" || (!session?.user && event !== "INITIAL_SESSION")) {
        // Signed out (explicit or due to token invalidation)
        setOnboardingCompleted(null);
        setLoading(false);
      }
      // TOKEN_REFRESHED with valid session, USER_UPDATED, INITIAL_SESSION, etc.
      // — no action needed; SDK already persisted the new token to AsyncStorage
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
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
