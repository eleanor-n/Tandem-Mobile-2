// notify-auto-accept — authenticated.
// Fires when a join_request is created with status='accepted' via the
// auto-accept path. Pushes to both poster and requester.
//
// Body: { activity_id: string, requester_id: string, poster_id: string }

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendPush(token: string, title: string, body: string, data: any) {
  if (!token) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default", data }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { activity_id, requester_id, poster_id } = await req.json();
    if (!activity_id || !requester_id || !poster_id) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const [{ data: activity }, { data: poster }, { data: requester }] = await Promise.all([
      supabase.from("activities").select("title").eq("id", activity_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, expo_push_token, notification_preferences")
        .eq("user_id", poster_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("first_name, expo_push_token, notification_preferences")
        .eq("user_id", requester_id)
        .maybeSingle(),
    ]);

    const title = activity?.title ?? "your tandem";

    // Notify requester: "you're in. ${posterName} said yes."
    if (
      requester?.expo_push_token &&
      requester?.notification_preferences?.accepted !== false
    ) {
      await sendPush(
        requester.expo_push_token,
        "you're in.",
        `${poster?.first_name ?? "they"} said yes to ${title}.`,
        { type: "request_accepted", activity_id },
      );
    }

    // Notify poster: "you're tandem'd with ${requesterName}. say hey."
    if (
      poster?.expo_push_token &&
      poster?.notification_preferences?.join_request !== false
    ) {
      await sendPush(
        poster.expo_push_token,
        "auto-accepted.",
        `you're tandem'd with ${requester?.first_name ?? "someone"}. say hey.`,
        { type: "auto_accept", activity_id },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
