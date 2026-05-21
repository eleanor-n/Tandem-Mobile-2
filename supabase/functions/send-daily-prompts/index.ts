// send-daily-prompts — invoked hourly by pg_cron.
// Sends a Sunny-voice push to each user whose local hour is currently 17
// (5pm), respecting the daily_prompts notification preference and a
// per-user-per-day log to prevent duplicates.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

const DAILY_PROMPT_TEMPLATES: Record<DayOfWeek, { body: string; action: string; actionPayload: Record<string, unknown> }> = {
  Sunday:    { body: "the week ahead is wide open. what's first?", action: "open_post_creation",          actionPayload: {} },
  Monday:    { body: "make monday less monday. anyone free tonight?", action: "open_vibing_creation",      actionPayload: {} },
  Tuesday:   { body: "tuesday could use a coffee.",                 action: "open_post_creation",          actionPayload: { category: "coffee" } },
  Wednesday: { body: "hump day hang?",                              action: "open_vibing_creation",        actionPayload: {} },
  Thursday:  { body: "almost the weekend. plan something.",         action: "open_post_creation",          actionPayload: {} },
  Friday:    { body: "what's the move?",                            action: "open_whats_the_move_sheet",   actionPayload: {} },
  Saturday:  { body: "you up to anything today?",                   action: "open_vibing_creation",        actionPayload: {} },
};

const DAY_NAMES: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

async function sendPush(token: string, body: string, data: any): Promise<void> {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      title: "",
      body,
      sound: "default",
      data,
    }),
  });
}

// Resolve the local date+day-of-week for a given IANA timezone using Intl.
function localDayInfo(tz: string): { hour: number; dayOfWeek: DayOfWeek; ymd: string } {
  const now = new Date();
  // 24-hour parts
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const weekday = get("weekday") as DayOfWeek;
  const ymd = `${get("year")}-${get("month")}-${get("day")}`;
  return { hour, dayOfWeek: weekday, ymd };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull every profile with a push token + timezone. Filter in JS by
    // local hour and preference; safer than a SQL time-of-day join.
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, timezone, expo_push_token, notification_preferences");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let usersNotified = 0;
    const errors: string[] = [];

    for (const p of (profiles ?? []) as any[]) {
      const tz = p.timezone ?? "America/New_York";
      const token = p.expo_push_token;
      const prefs = p.notification_preferences ?? {};
      if (!token) continue;
      if (prefs?.daily_prompts === false) continue;

      let info: { hour: number; dayOfWeek: DayOfWeek; ymd: string };
      try {
        info = localDayInfo(tz);
      } catch {
        info = localDayInfo("America/New_York");
      }
      if (info.hour !== 17) continue;
      if (!DAY_NAMES.includes(info.dayOfWeek)) continue;

      // Has a prompt already been logged for this user "today" (their local
      // calendar day)?
      const { data: existingLog } = await supabase
        .from("daily_prompt_log")
        .select("id, sent_at")
        .eq("user_id", p.user_id)
        .gte("sent_at", `${info.ymd}T00:00:00.000Z`)
        .lt("sent_at", `${info.ymd}T23:59:59.999Z`)
        .limit(1)
        .maybeSingle();
      // Note: the Z-anchored bounds are intentionally lenient; the goal is
      // "did we already send today?" and the log holds at most one row per
      // user per UTC day. If a user's local 5pm wraps over UTC midnight this
      // still works because the cron fires every hour and we only send once.
      if (existingLog) continue;

      const template = DAILY_PROMPT_TEMPLATES[info.dayOfWeek];
      try {
        await sendPush(token, template.body, {
          kind: "daily_prompt",
          action: template.action,
          actionPayload: template.actionPayload,
        });
        await supabase.from("daily_prompt_log").insert({
          user_id: p.user_id,
          day_of_week: info.dayOfWeek,
          prompt_template_key: info.dayOfWeek,
        } as any);
        usersNotified++;
      } catch (err: any) {
        errors.push(`${p.user_id}: ${err?.message ?? "send failed"}`);
      }
    }

    return new Response(
      JSON.stringify({ users_notified: usersNotified, errors }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
