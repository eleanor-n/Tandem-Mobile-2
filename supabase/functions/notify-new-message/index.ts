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
    // record is the new row from messages

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the tandem to find both participants
    const { data: tandem } = await supabase
      .from("tandems")
      .select("user_a_id, user_b_id")
      .eq("id", record.tandem_id)
      .single();

    if (!tandem) return new Response("no tandem", { status: 404 });

    // Recipient is whichever participant is NOT the sender
    const recipientId =
      tandem.user_a_id === record.sender_id
        ? tandem.user_b_id
        : tandem.user_a_id;

    // Get recipient's push token
    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("user_id", recipientId)
      .single();

    if (!recipientProfile?.expo_push_token) {
      return new Response("no push token", { status: 200 });
    }

    // Get sender's first name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", record.sender_id)
      .single();

    const senderName = senderProfile?.first_name ?? "someone";
    const messageText = (record.content ?? "").slice(0, 80);

    // Send via Expo Push API
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
  } catch (err) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
