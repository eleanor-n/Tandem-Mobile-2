// create-spot-share — authenticated.
// Called when a user starts sharing their tandem spot with an outside friend.
//
// Body:
//   { tandem_id: string, recipient_name?: string, recipient_phone?: string,
//     expires_in_hours?: number }
//
// Returns:
//   { share_id: string, public_url: string }
//
// Side effects:
//   - Inserts a row in spot_shares with an 8-char alphanumeric share_id
//   - Pushes a notification to the partner ("[name] sent the spot to a friend")

import { createClient } from "jsr:@supabase/supabase-js@2";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
function makeShareId(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Resolve caller user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { tandem_id, recipient_name, recipient_phone, expires_in_hours } = body ?? {};
    if (!tandem_id) {
      return new Response(JSON.stringify({ error: "tandem_id required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Verify caller is part of the tandem
    const { data: tandem } = await supabase
      .from("tandems")
      .select("id, user_a_id, user_b_id, activity_id")
      .eq("id", tandem_id)
      .maybeSingle();
    if (!tandem) {
      return new Response(JSON.stringify({ error: "tandem not found" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (tandem.user_a_id !== userId && tandem.user_b_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const partnerId = tandem.user_a_id === userId ? tandem.user_b_id : tandem.user_a_id;

    // Generate unique share_id (retry on collision)
    let shareId = makeShareId();
    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: existing } = await supabase
        .from("spot_shares")
        .select("share_id")
        .eq("share_id", shareId)
        .maybeSingle();
      if (!existing) break;
      shareId = makeShareId();
    }

    const expiresAt = new Date(
      Date.now() + (expires_in_hours ?? 6) * 60 * 60 * 1000,
    ).toISOString();

    const { data: shareRow, error: insertErr } = await supabase
      .from("spot_shares")
      .insert({
        share_id: shareId,
        tandem_id,
        sharer_user_id: userId,
        partner_user_id: partnerId,
        recipient_name: recipient_name ?? null,
        recipient_phone: recipient_phone ?? null,
        expires_at: expiresAt,
        status: "active",
      } as any)
      .select("share_id, expires_at")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `https://thetandemweb.com/spot-share/${shareId}`;

    // Partner push (UPDATE 12)
    try {
      const { data: sharerProf } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("user_id", userId)
        .single();
      const { data: partnerProf } = await supabase
        .from("profiles")
        .select("expo_push_token, notification_preferences")
        .eq("user_id", partnerId)
        .single();

      if (
        partnerProf?.expo_push_token &&
        partnerProf?.notification_preferences?.spot_shared !== false
      ) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: partnerProf.expo_push_token,
            title: "spot shared.",
            body: `${sharerProf?.first_name ?? "your tandem partner"} let a friend know where you're meeting.`,
            sound: "default",
            data: { type: "spot_shared", tandem_id, share_id: shareId },
          }),
        });
      }

      // Drop an in-chat notice message
      await supabase.from("messages").insert({
        tandem_id,
        sender_id: userId,
        content: `${sharerProf?.first_name ?? "they"} sent the spot to a friend.`,
        system_kind: "spot_shared",
      } as any);
    } catch (notifyErr) {
      console.warn("[create-spot-share] notify failed:", notifyErr);
    }

    return new Response(
      JSON.stringify({
        share_id: shareRow.share_id,
        public_url: publicUrl,
        expires_at: shareRow.expires_at,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
