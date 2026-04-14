import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { createClient, AuthApiError } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://ccntlaunczirvntnsjbm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjbnRsYXVuY3ppcnZudG5zamJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTg2NzAsImV4cCI6MjA4ODczNDY3MH0.NkLQ2ue5YdZgSDFCqgVSnnta67KIC4fJ0VY5asGqdb0";

// Chunked SecureStore adapter — Supabase session tokens exceed SecureStore's
// 2048-byte per-key limit, so we split across sequential keys (key.0, key.1, …).
const chunkSize = 1024;
const storage = {
  async getItem(key: string): Promise<string | null> {
    const chunks: string[] = [];
    let i = 0;
    while (true) {
      try {
        const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
        if (chunk === null) break;
        chunks.push(chunk);
        i++;
      } catch { break; }
    }
    return chunks.length ? chunks.join("") : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += chunkSize) {
      chunks.push(value.slice(i, i + chunkSize));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk))
    );
  },
  async removeItem(key: string): Promise<void> {
    let i = 0;
    while (true) {
      try {
        const exists = await SecureStore.getItemAsync(`${key}.${i}`);
        if (exists === null) break;
        await SecureStore.deleteItemAsync(`${key}.${i}`);
        i++;
      } catch { break; }
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
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

// ── RLS Policy Verification (run in Supabase SQL editor) ─────────────────────
// -- Verify all RLS policies exist:
// -- select tablename, policyname, cmd
// --   from pg_policies
// --  where schemaname = 'public'
// --  order by tablename, cmd;
//
// -- Required policies:
// -- activities:  SELECT  (auth.uid() is not null)
// -- activities:  INSERT  (user_id = auth.uid())
// -- activities:  UPDATE  (user_id = auth.uid())
// -- activities:  DELETE  (user_id = auth.uid())
// -- profiles:    SELECT  (true)
// -- profiles:    INSERT  (user_id = auth.uid())
// -- profiles:    UPDATE  (user_id = auth.uid())
// -- join_requests: SELECT  (requester_id = auth.uid() or activity host)
// -- join_requests: INSERT  (requester_id = auth.uid())
// -- activity_interactions: SELECT (user_id = auth.uid())
// -- activity_interactions: INSERT (user_id = auth.uid())
// -- tandems:     SELECT  (user_a_id = auth.uid() or user_b_id = auth.uid())
// -- tandems:     INSERT  (user_a_id = auth.uid())
// -- messages:    SELECT  (participant via tandem)
// -- messages:    INSERT  (sender_id = auth.uid())

// ── Block / Report Tables (run in Supabase SQL editor) ───────────────────────
// -- create table if not exists public.blocks (
// --   id uuid default gen_random_uuid() primary key,
// --   blocker_id uuid references auth.users(id) on delete cascade,
// --   blocked_id  uuid references auth.users(id) on delete cascade,
// --   created_at  timestamptz default now(),
// --   unique(blocker_id, blocked_id)
// -- );
// -- alter table public.blocks enable row level security;
// -- create policy "Users manage own blocks" on public.blocks
// --   for all using (blocker_id = auth.uid());
//
// -- create table if not exists public.reports (
// --   id              uuid default gen_random_uuid() primary key,
// --   reporter_id     uuid references auth.users(id) on delete cascade,
// --   reported_user_id uuid references auth.users(id),
// --   activity_id     uuid references public.activities(id),
// --   reason          text not null,
// --   created_at      timestamptz default now()
// -- );
// -- alter table public.reports enable row level security;
// -- create policy "Users can create reports" on public.reports
// --   for insert with check (reporter_id = auth.uid());

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
