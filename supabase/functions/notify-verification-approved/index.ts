// Invoked from AdminReviewScreen after approval.
// Body: { user_id: string }
// Deploy: supabase functions deploy notify-verification-approved

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response("missing user_id", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("user_id", user_id)
      .single();

    if (!profile?.expo_push_token) {
      return new Response("no push token", { status: 200 });
    }

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: profile.expo_push_token,
        title: "you're in",
        body: "selfie verified. go tandem with someone.",
        sound: "default",
        data: { type: "verification_approved" },
      }),
    });

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    return new Response(`error: ${err.message}`, { status: 500 });
  }
});
