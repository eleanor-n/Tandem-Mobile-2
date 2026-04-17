// Sunny Birthday Notifications — Supabase Edge Function
// Deploy: supabase functions deploy sunny-birthday-notifications
// Schedule: set cron in Supabase dashboard → Edge Functions → sunny-birthday-notifications → Schedule: 0 9 * * *
// Required secrets: ONESIGNAL_REST_API_KEY, ONESIGNAL_APP_ID
// SETUP CHECKLIST:
// 1. Supabase dashboard → Edge Functions → Secrets, add:
//    ONESIGNAL_REST_API_KEY (from OneSignal → Settings → Keys & IDs → REST API Key)
//    ONESIGNAL_APP_ID = 6ff11a5c-9d87-4370-86ba-d28e4e9a1b31
// 2. In OneSignal dashboard → Settings → Tags, ensure "user_id" tag is set on device registration.
//    In the app client (when OneSignal re-enabled for EAS build), call: OneSignal.login(user.id)
// 3. Supabase dashboard → Edge Functions → sunny-birthday-notifications → Schedule: 0 9 * * *
// 4. profiles.birthday must be stored as YYYY-MM-DD string or date type.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, first_name, birthday")
    .not("birthday", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Filter in JS since Supabase doesn't support EXTRACT in client filters
  const todayBirthdays = (profiles ?? []).filter((p) => {
    if (!p.birthday) return false;
    const bday = new Date(p.birthday);
    return bday.getMonth() + 1 === month && bday.getDate() === day;
  });

  const sent: string[] = [];
  const errors: string[] = [];

  for (const profile of todayBirthdays) {
    try {
      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          filters: [
            { field: "tag", key: "user_id", relation: "=", value: profile.user_id },
          ],
          headings: { en: "happy birthday" },
          contents: {
            en: "it's sunny. today's your day. do something worth tandeming about.",
          },
          name: "birthday_notification",
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        errors.push(`${profile.user_id}: ${body}`);
      } else {
        sent.push(profile.user_id);
      }
    } catch (err: any) {
      errors.push(`${profile.user_id}: ${err.message}`);
    }
  }

  return new Response(
    JSON.stringify({ sent: sent.length, errors }),
    { headers: { "Content-Type": "application/json" } }
  );
});
