// SUPABASE SETUP — create a Database Webhook to trigger this function:
// Dashboard → Database → Webhooks → Create a new hook
// Name:     notify-join-request
// Table:    public.join_requests
// Events:   INSERT
// Type:     Supabase Edge Function
// Function: notify-join-request

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    // record is the new row from join_requests

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the activity and its owner
    const { data: activity } = await supabase
      .from("activities")
      .select("user_id, title")
      .eq("id", record.activity_id)
      .single();

    if (!activity) return new Response("no activity", { status: 404 });

    // Get post owner's push token
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("expo_push_token, first_name")
      .eq("user_id", activity.user_id)
      .single();

    // Get requester's first name
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", record.requester_id)
      .single();

    if (!ownerProfile?.expo_push_token) {
      return new Response("no push token", { status: 200 });
    }

    const requesterName = requesterProfile?.first_name ?? "someone";

    // Send via Expo Push API
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: ownerProfile.expo_push_token,
        title: "someone's in",
        body: `${requesterName} wants to tandem with you on ${activity.title}. take a look.`,
        sound: "default",
        data: { type: "join_request", activity_id: record.activity_id },
      }),
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
