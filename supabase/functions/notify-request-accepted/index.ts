// SUPABASE SETUP — create a Database Webhook to trigger this function:
// Dashboard → Database → Webhooks → Create a new hook
// Name:     notify-request-accepted
// Table:    public.join_requests
// Events:   UPDATE
// Type:     Supabase Edge Function
// Function: notify-request-accepted

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    // record is the updated row from join_requests

    // Only fire when status was just set to "accepted"
    if (record.status !== "accepted") {
      return new Response("not accepted", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the activity and its owner's name
    const { data: activity } = await supabase
      .from("activities")
      .select("user_id, title")
      .eq("id", record.activity_id)
      .single();

    if (!activity) return new Response("no activity", { status: 404 });

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", activity.user_id)
      .single();

    // Get requester's push token
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("expo_push_token, first_name")
      .eq("user_id", record.requester_id)
      .single();

    if (!requesterProfile?.expo_push_token) {
      return new Response("no push token", { status: 200 });
    }

    const ownerName = ownerProfile?.first_name ?? "they";

    // Send via Expo Push API
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: requesterProfile.expo_push_token,
        title: "you're in!",
        body: `${ownerName} accepted you for ${activity.title}. say hey.`,
        sound: "default",
        data: { type: "request_accepted", activity_id: record.activity_id },
      }),
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
