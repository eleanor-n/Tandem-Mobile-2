// SUPABASE SETUP — create a Database Webhook to trigger this function:
// Dashboard → Database → Webhooks → Create a new hook
// Name:     notify-new-message
// Table:    public.messages
// Events:   INSERT
// Type:     Supabase Edge Function
// Function: notify-new-message

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tandem } = await supabase
      .from("tandems")
      .select("user_a_id, user_b_id")
      .eq("id", record.tandem_id)
      .single();

    if (!tandem) return new Response("no tandem", { status: 404 });

    const recipientId =
      tandem.user_a_id === record.sender_id ? tandem.user_b_id : tandem.user_a_id;

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("expo_push_token, notification_preferences")
      .eq("user_id", recipientId)
      .single();

    // Check opt-out
    if (recipientProfile?.notification_preferences?.new_message === false) {
      return new Response("user opted out", { status: 200 });
    }

    if (!recipientProfile?.expo_push_token) {
      return new Response("no push token", { status: 200 });
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", record.sender_id)
      .single();

    const senderName = senderProfile?.first_name ?? "someone";
    const messageText = (record.content ?? "").slice(0, 80);

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipientProfile.expo_push_token,
        title: senderName,
        body: messageText,
        sound: "default",
        data: { type: "new_message", tandem_id: record.tandem_id },
      }),
    });

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
