// get-spot-share — PUBLIC, no auth required.
// Returns sanitized info for a share_id so a recipient can see who's meeting
// whom, where, and the latest location.
//
// Usage:
//   GET /functions/v1/get-spot-share?id=ABCD1234
//   or
//   POST { "share_id": "ABCD1234" }
//
// Returns only safe fields — never email, phone, full last name, etc.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function publicProfile(p: any) {
  if (!p) return null;
  return {
    first_name: p.first_name ?? null,
    avatar_url: p.avatar_url ?? null,
    pronouns: p.pronouns ?? null,
    trust_tier: p.trust_tier ?? "new",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    let shareId: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      shareId = url.searchParams.get("id");
    } else {
      const body = await req.json().catch(() => ({}));
      shareId = body?.share_id ?? null;
    }
    if (!shareId) {
      return new Response(JSON.stringify({ error: "share_id required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: share } = await supabase
      .from("spot_shares")
      .select(
        "share_id, tandem_id, sharer_user_id, partner_user_id, recipient_name, status, expires_at, current_lat, current_lng, location_updated_at, created_at",
      )
      .eq("share_id", shareId)
      .maybeSingle();

    if (!share) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Expired or ended
    const expired = new Date(share.expires_at).getTime() < Date.now();
    if (expired || share.status === "ended") {
      return new Response(
        JSON.stringify({
          share_id: share.share_id,
          status: expired ? "expired" : share.status,
          ended_at: share.location_updated_at,
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Profiles
    const { data: sharerProf } = await supabase
      .from("profiles")
      .select("first_name, avatar_url, pronouns, trust_tier")
      .eq("user_id", share.sharer_user_id)
      .maybeSingle();
    const { data: partnerProf } = await supabase
      .from("profiles")
      .select("first_name, avatar_url, pronouns, trust_tier")
      .eq("user_id", share.partner_user_id)
      .maybeSingle();

    // Activity for the meeting venue
    const { data: tandem } = await supabase
      .from("tandems")
      .select("activity_id")
      .eq("id", share.tandem_id)
      .maybeSingle();

    let activity: any = null;
    if (tandem?.activity_id) {
      const { data: act } = await supabase
        .from("activities")
        .select("title, location_name, activity_date, activity_time")
        .eq("id", tandem.activity_id)
        .maybeSingle();
      activity = act ?? null;
    }

    return new Response(
      JSON.stringify({
        share_id: share.share_id,
        status: share.status,
        recipient_name: share.recipient_name,
        expires_at: share.expires_at,
        current_lat: share.current_lat,
        current_lng: share.current_lng,
        location_updated_at: share.location_updated_at,
        sharer: publicProfile(sharerProf),
        partner: publicProfile(partnerProf),
        activity,
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
