// notify-vibe-join — authenticated.
// Pushes "[name] is in for your vibe." to the vibe-user when someone taps
// "i'm in" on their ambient vibing card.
//
// Body: { vibe_user_id: string, joiner_name: string, tandem_id?: string }

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { vibe_user_id, joiner_name, tandem_id } = await req.json();
    if (!vibe_user_id || !joiner_name) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("expo_push_token, notification_preferences")
      .eq("user_id", vibe_user_id)
      .maybeSingle();

    if (
      !target?.expo_push_token ||
      target?.notification_preferences?.vibe_join === false
    ) {
      return new Response("ok", { status: 200, headers: CORS });
    }

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: target.expo_push_token,
        title: `${joiner_name} is in for your vibe.`,
        body: "",
        sound: "default",
        data: { type: "vibe_join", tandem_id },
      }),
    });

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
