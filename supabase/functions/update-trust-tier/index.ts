// Trust tier promotion/demotion engine.
// Called explicitly after: tandem_completion insert, user_reports insert,
// safety_checkins response_value update.
//
// Body: { user_id: string, trigger: "completion" | "report" | "checkin" }
// Deploy: supabase functions deploy update-trust-tier
// Required secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMOTE_KNOWN_THRESHOLD = 3;
const PROMOTE_TRUSTED_THRESHOLD = 10;
const DEMOTION_WINDOW_DAYS = 30;

const MILESTONES = [5, 10, 25, 50, 100];
const MILESTONE_TEMPLATES: Record<number, string> = {
  5: "5 tandems. you're rolling.",
  10: "you just hit 10 tandems. that's a lot of company.",
  25: "25 tandems. you're a known quantity now.",
  50: "50 tandems. half a hundred different connections.",
  100: "100 tandems. you've made tandem a habit. that's the whole point.",
};

async function sendMilestonePush(
  supabase: any,
  userId: string,
  count: number,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("expo_push_token, notification_preferences")
    .eq("user_id", userId)
    .maybeSingle();
  const token = (profile as any)?.expo_push_token;
  if (!token) return;
  if ((profile as any)?.notification_preferences?.milestones === false) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title: "",
        body: MILESTONE_TEMPLATES[count],
        sound: "default",
        data: { kind: "milestone", count },
      }),
    });
  } catch (err: any) {
    console.warn("[trust-tier] milestone push failed:", err?.message ?? err);
  }
}

type Tier = "new" | "known" | "trusted";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendPushTo(supabase: any, userId: string, title: string, body: string) {
  const { data } = await supabase
    .from("profiles")
    .select("expo_push_token")
    .eq("user_id", userId)
    .maybeSingle();
  const token = (data as any)?.expo_push_token;
  if (!token) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: "default", data: { type: "tier_change" } }),
    });
  } catch (err: any) {
    console.warn("[trust-tier] push failed:", err?.message ?? err);
  }
}

async function notifyAdminSuspension(reportedUserId: string, reason: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendApiKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: "Tandem Alerts <sunny@thetandemweb.com>",
        to: "eleanornayden@gmail.com",
        subject: `[Tandem] User auto-suspended: ${reportedUserId}`,
        text: `User ${reportedUserId} has been auto-suspended.\n\nReason: ${reason}\n\nReview at: https://supabase.com/dashboard/project/ccntlaunczirvntnsjbm`,
      }),
    });
  } catch (err: any) {
    console.warn("[trust-tier] admin email failed:", err?.message ?? err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { user_id, trigger } = await req.json();
    if (!user_id) return jsonResponse({ error: "missing user_id" }, 400);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, trust_tier, completed_tandem_count, suspended, first_name")
      .eq("user_id", user_id)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) return jsonResponse({ error: "profile not found" }, 404);

    const currentTier = ((profile as any).trust_tier ?? "new") as Tier;
    const currentCount = (profile as any).completed_tandem_count ?? 0;
    const currentlySuspended = !!(profile as any).suspended;

    const windowStart = new Date(Date.now() - DEMOTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Count distinct reporters in the window
    const { data: reports } = await supabase
      .from("user_reports")
      .select("reporter_user_id")
      .eq("reported_user_id", user_id)
      .gte("created_at", windowStart);
    const distinctReporters = new Set(
      ((reports ?? []) as any[]).map((r) => r.reporter_user_id),
    ).size;

    // Count not_great check-ins in the window
    const { data: badCheckins } = await supabase
      .from("safety_checkins")
      .select("id")
      .eq("user_id", user_id)
      .eq("response_value", "not_great")
      .gte("created_at", windowStart);
    const badCheckinCount = (badCheckins ?? []).length;

    // Recompute completed_tandem_count from the source of truth so we trust it
    // even if the denormalized counter drifted.
    const { count: completedCount } = await supabase
      .from("tandem_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id);

    let nextTier: Tier = currentTier;
    let suspend = currentlySuspended;
    let suspendReason = "";

    // Suspension first — it overrides tier
    if (distinctReporters >= 3 || (badCheckinCount >= 2 && distinctReporters >= 1)) {
      suspend = true;
      suspendReason = `${distinctReporters} reports + ${badCheckinCount} not_great check-ins in last ${DEMOTION_WINDOW_DAYS}d`;
    }

    const hasDemotionSignal = distinctReporters >= 2 || badCheckinCount >= 2;

    if (suspend) {
      nextTier = "new";
    } else if (hasDemotionSignal) {
      nextTier = "new";
    } else {
      // Promotion path — no demotion signal in window
      const realCount = completedCount ?? currentCount;
      if (realCount >= PROMOTE_TRUSTED_THRESHOLD) nextTier = "trusted";
      else if (realCount >= PROMOTE_KNOWN_THRESHOLD) nextTier = "known";
      else nextTier = "new";
    }

    const update: Record<string, any> = {
      trust_tier: nextTier,
      completed_tandem_count: completedCount ?? currentCount,
    };
    if (suspend !== currentlySuspended) update.suspended = suspend;

    await supabase.from("profiles").update(update as any).eq("user_id", user_id);

    // Milestone celebration push — only when the count crosses a threshold
    // this run (newCount === milestone AND oldCount < milestone).
    const newCount = completedCount ?? currentCount;
    const crossedMilestone = MILESTONES.find(
      (m) => newCount === m && currentCount < m,
    );
    if (crossedMilestone) {
      await sendMilestonePush(supabase, user_id, crossedMilestone);
    }

    // Notify on tier change (promotion only — demotion is silent per spec)
    if (nextTier !== currentTier) {
      if (nextTier === "known" && currentTier === "new") {
        await sendPushTo(
          supabase,
          user_id,
          "you're a Known Tandemer now.",
          "that's three under your belt.",
        );
      } else if (nextTier === "trusted") {
        await sendPushTo(
          supabase,
          user_id,
          "Trusted Tandemer.",
          "ten tandems deep.",
        );
      }
    }

    if (suspend && !currentlySuspended) {
      await notifyAdminSuspension(user_id, suspendReason);
    }

    return jsonResponse({
      ok: true,
      previousTier: currentTier,
      nextTier,
      suspended: suspend,
      reporters30d: distinctReporters,
      notGreatCheckins30d: badCheckinCount,
      completedCount: completedCount ?? currentCount,
      trigger,
    });
  } catch (err: any) {
    console.error("[trust-tier] error:", err?.message ?? err);
    return jsonResponse({ error: err?.message ?? String(err) }, 500);
  }
});
