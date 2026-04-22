// Run this SQL in Supabase SQL editor to create the error_logs table:
//
// create table if not exists public.error_logs (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete set null,
//   error_message text not null,
//   error_stack text,
//   error_context jsonb,
//   platform text,
//   app_version text,
//   created_at timestamptz default now()
// );
//
// alter table public.error_logs enable row level security;
//
// create policy "Users can insert own errors"
//   on public.error_logs for insert
//   with check (user_id = auth.uid() or user_id is null);
//
// create policy "Users can view own errors"
//   on public.error_logs for select
//   using (user_id = auth.uid());

import { supabase } from "./supabase";
import { Platform } from "react-native";
import Constants from "expo-constants";

interface ErrorContext {
  screen?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export async function logError(
  error: Error | string,
  context?: ErrorContext
): Promise<void> {
  try {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorStack = typeof error === "string" ? null : (error.stack ?? null);

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("error_logs").insert({
      user_id: user?.id ?? null,
      error_message: errorMessage,
      error_stack: errorStack,
      error_context: context ?? null,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? "unknown",
    });

    console.log("[ErrorLogger]", errorMessage, context);
  } catch {
    // Never let error logging crash the app
    console.log("[ErrorLogger] failed to log:", error);
  }
}
