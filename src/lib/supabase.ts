import { createClient, AuthApiError } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const SUPABASE_URL = "https://ccntlaunczirvntnsjbm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjbnRsYXVuY3ppcnZudG5zamJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTg2NzAsImV4cCI6MjA4ODczNDY3MH0.NkLQ2ue5YdZgSDFCqgVSnnta67KIC4fJ0VY5asGqdb0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Stop auto-refresh when the app goes to background so iOS cannot suspend the
// JS thread mid-refresh (which rotates the server token but fails to persist
// the new one, causing "Invalid Refresh Token: Refresh Token Not Found" on resume).
// Resume auto-refresh when the app becomes active again.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

const STALE_SESSION_KEYS = [
  "supabase.auth.token",
  "tandem_has_onboarded",
  "tandem_sunny_welcomed",
];

export const handleSupabaseError = async (error: unknown) => {
  if (
    error instanceof AuthApiError &&
    (error.message.includes("Refresh Token Not Found") ||
      error.message.includes("Invalid Refresh Token"))
  ) {
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove(STALE_SESSION_KEYS);
  }
};
