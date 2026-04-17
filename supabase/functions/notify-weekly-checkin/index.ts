// SUPABASE SETUP — schedule this function on a cron:
// Dashboard → Edge Functions → notify-weekly-checkin → Schedule
// Cron expression: 0 10 * * 1   (every Monday at 10am UTC)
//
// No webhook needed — this is a scheduled function, not event-triggered.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find users who haven't been active in 7 days, have completed onboarding,
    // and have a push token
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, expo_push_token")
      .eq("onboarding_completed", true)
      .not("expo_push_token", "is", null)
      .lt("updated_at", sevenDaysAgo);

    if (!profiles || profiles.length === 0) {
      return new Response("no inactive users", { status: 200 });
    }

    const tokens = profiles
      .map((p: any) => p.expo_push_token)
      .filter(Boolean);

    if (tokens.length === 0) {
      return new Response("no push tokens", { status: 200 });
    }

    // Send to each inactive user
    await Promise.all(
      tokens.map((token: string) =>
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: token,
            title: "sunny here",
            body: "haven't tandemed in a week. see who's up to something.",
            sound: "default",
            data: { type: "weekly_checkin" },
          }),
        })
      )
    );

    return new Response(`ok: sent to ${tokens.length} users`, { status: 200 });
  } catch (err) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
