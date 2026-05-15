// update-spot-location — authenticated.
// Called periodically by the sharer's device to push a location update.
//
// Body:
//   { share_id: string, lat: number, lng: number }

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { share_id, lat, lng } = body ?? {};
    if (!share_id || typeof lat !== "number" || typeof lng !== "number") {
      return new Response(
        JSON.stringify({ error: "share_id, lat, lng required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Verify caller is the sharer
    const { data: share } = await supabase
      .from("spot_shares")
      .select("share_id, sharer_user_id, status, expires_at")
      .eq("share_id", share_id)
      .maybeSingle();
    if (!share || share.sharer_user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (share.status === "ended" || new Date(share.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "share not active" }), {
        status: 410,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("spot_shares")
      .update({
        current_lat: lat,
        current_lng: lng,
        location_updated_at: new Date().toISOString(),
      } as any)
      .eq("share_id", share_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
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
