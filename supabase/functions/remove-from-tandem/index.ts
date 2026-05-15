// remove-from-tandem — authenticated.
// Only the poster of the activity may call this. Removes a joiner from a
// specific tandem without blocking them platform-wide.
//
// Body: { tandem_id: string }
//
// Side effects:
//   - Marks the matching join_request row as status='removed'
//   - Deletes the tandem row so the chat disappears for the removed user
//   - Inserts into tandem_removals for admin pattern detection
//   - Pushes a Sunny message to the removed user
//   - If the poster has removed 3+ users in 30d, emails admin via Resend

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "eleanornayden@gmail.com";
const REMOVAL_PATTERN_THRESHOLD = 3;
const PATTERN_WINDOW_DAYS = 30;

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
    const remover = userData.user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { tandem_id } = await req.json();
    if (!tandem_id) {
      return new Response(JSON.stringify({ error: "tandem_id required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Look up the tandem + verify caller is the poster of the underlying activity
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

    const { data: activity } = await supabase
      .from("activities")
      .select("user_id, title")
      .eq("id", tandem.activity_id)
      .maybeSingle();
    if (!activity) {
      return new Response(JSON.stringify({ error: "activity not found" }), {
        status: 404,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (activity.user_id !== remover) {
      return new Response(
        JSON.stringify({ error: "only the poster may remove a joiner" }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Identify the joiner (the user who is NOT the poster)
    const removed = tandem.user_a_id === remover ? tandem.user_b_id : tandem.user_a_id;

    // Mark join_requests row removed
    await supabase
      .from("join_requests")
      .update({ status: "removed" } as any)
      .eq("activity_id", tandem.activity_id)
      .eq("requester_id", removed);

    // Delete the tandem so messages stop and chat list drops for both sides;
    // logging the removal preserves audit context independently.
    await supabase.from("tandems").delete().eq("id", tandem_id);

    await supabase.from("tandem_removals").insert({
      tandem_id,
      removed_user_id: removed,
      remover_user_id: remover,
    } as any);

    // Sunny push to the removed user
    const { data: removedProf } = await supabase
      .from("profiles")
      .select("expo_push_token, notification_preferences")
      .eq("user_id", removed)
      .maybeSingle();
    if (
      removedProf?.expo_push_token &&
      removedProf?.notification_preferences?.removed !== false
    ) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: removedProf.expo_push_token,
          title: "tandem update.",
          body: "the tandem you joined isn't happening for you anymore. it's okay.",
          sound: "default",
          data: { type: "tandem_removed" },
        }),
      });
    }

    // Pattern detection — 3+ removals from this poster in the trailing 30d
    const since = new Date(Date.now() - PATTERN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("tandem_removals")
      .select("id", { count: "exact", head: true })
      .eq("remover_user_id", remover)
      .gte("created_at", since);

    if ((count ?? 0) >= REMOVAL_PATTERN_THRESHOLD) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const { data: removerProf } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("user_id", remover)
          .maybeSingle();
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Tandem Safety <sunny@thetandemweb.com>",
            to: [ADMIN_EMAIL],
            subject: `[TANDEM] removal pattern from ${removerProf?.first_name ?? "user"} (${remover})`,
            text:
              `${removerProf?.first_name ?? "User"} (${remover}) has removed ` +
              `${count} users from tandems in the last ${PATTERN_WINDOW_DAYS} days. ` +
              `Review their post + joiner history at ${Deno.env.get("SUPABASE_URL")}/project/default.`,
          }),
        });
      }
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
