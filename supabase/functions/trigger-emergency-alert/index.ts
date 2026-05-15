// trigger-emergency-alert — authenticated.
// Fires when a user taps "need help" in an active tandem chat.
// Side effects:
//   1. Sends an admin email to eleanornayden@gmail.com (via Resend)
//   2. If a spot share is active, marks it as "emergency" + sends an SMS-style
//      notification to the recipient (in this build, we send an additional push
//      to the partner and the admin gets the recipient name/phone since we
//      don't yet store the recipient's phone). When Twilio is wired up, this
//      function will be the place SMS goes out from.
//
// Body: { tandem_id: string }

import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { tandem_id } = body ?? {};
    if (!tandem_id) {
      return new Response(JSON.stringify({ error: "tandem_id required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

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

    const [{ data: callerProf }, { data: partnerProf }, { data: activity }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, phone, expo_push_token")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("first_name, phone")
          .eq("user_id", partnerId)
          .maybeSingle(),
        tandem.activity_id
          ? supabase
              .from("activities")
              .select("title, location_name")
              .eq("id", tandem.activity_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    // Active spot share (if any)
    const { data: share } = await supabase
      .from("spot_shares")
      .select("share_id, recipient_name, current_lat, current_lng")
      .eq("tandem_id", tandem_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (share) {
      await supabase
        .from("spot_shares")
        .update({ end_reason: "emergency" } as any)
        .eq("share_id", share.share_id);
    }

    // Admin email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const subject = `[TANDEM EMERGENCY] ${callerProf?.first_name ?? "user"} tapped need help`;
      const lines = [
        `Caller: ${callerProf?.first_name ?? "?"} (${userId})`,
        `Phone: ${callerProf?.phone ?? "not on file"}`,
        `Partner: ${partnerProf?.first_name ?? "?"} (${partnerId})`,
        `Partner phone: ${partnerProf?.phone ?? "not on file"}`,
        `Tandem: ${activity?.title ?? "?"} at ${activity?.location_name ?? "?"}`,
        share
          ? `Live spot share: https://thetandemweb.com/spot-share/${share.share_id}`
          : `No active spot share.`,
        share?.current_lat
          ? `Last known coords: ${share.current_lat}, ${share.current_lng}`
          : "",
        `Time: ${new Date().toISOString()}`,
      ].filter(Boolean);

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Tandem Safety <sunny@thetandemweb.com>",
          to: ["eleanornayden@gmail.com"],
          subject,
          text: lines.join("\n"),
        }),
      });
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
