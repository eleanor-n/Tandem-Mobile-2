// SUPABASE SETUP — schedule this function on a cron:
// Dashboard → Edge Functions → notify-activity-reminder → Schedule
// Cron expression: */15 * * * *   (every 15 minutes)
//
// No webhook needed — this is a scheduled function, not event-triggered.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const in55min = new Date(now.getTime() + 55 * 60 * 1000);
    const in70min = new Date(now.getTime() + 70 * 60 * 1000);

    // Fetch activities starting in ~1 hour
    const targetDate = in55min.toISOString().split("T")[0];
    const startTime = in55min.toTimeString().split(" ")[0];
    const endTime = in70min.toTimeString().split(" ")[0];

    const { data: activities } = await supabase
      .from("activities")
      .select("id, user_id, title, activity_date, activity_time")
      .eq("status", "active")
      .eq("activity_date", targetDate)
      .gte("activity_time", startTime)
      .lte("activity_time", endTime);

    if (!activities || activities.length === 0) {
      return new Response("no activities", { status: 200 });
    }

    for (const activity of activities) {
      // Collect all participant user IDs: owner + accepted requesters
      const participantIds = new Set<string>();
      participantIds.add(activity.user_id);

      const { data: accepted } = await supabase
        .from("join_requests")
        .select("requester_id")
        .eq("activity_id", activity.id)
        .eq("status", "accepted");

      accepted?.forEach((r: any) => participantIds.add(r.requester_id));

      // Get push tokens for all participants
      const { data: profiles } = await supabase
        .from("profiles")
        .select("expo_push_token")
        .in("user_id", Array.from(participantIds));

      const tokens = (profiles ?? [])
        .map((p: any) => p.expo_push_token)
        .filter(Boolean);

      if (tokens.length === 0) continue;

      // Send to each participant
      await Promise.all(
        tokens.map((token: string) =>
          fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: token,
              title: "tandem in an hour",
              body: `${activity.title} starts soon. get ready.`,
              sound: "default",
              data: { type: "activity_reminder", activity_id: activity.id },
            }),
          })
        )
      );
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
