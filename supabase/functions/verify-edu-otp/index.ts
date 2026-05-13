// Edu email OTP — verify the 6-digit code and flip profiles.edu_verified.
// Deploy: supabase functions deploy verify-edu-otp
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, code } = await req.json();
    if (typeof email !== "string" || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "missing email or code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trimmedEmail = email.toLowerCase().trim();
    const trimmedCode = code.trim();

    const { data: row, error: lookupErr } = await supabaseService
      .from("edu_verifications")
      .select("id, expires_at, verified_at")
      .eq("user_id", user.id)
      .eq("email", trimmedEmail)
      .eq("code", trimmedCode)
      .is("verified_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (!row) {
      return new Response(JSON.stringify({ error: "that code didn't match. try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseService
      .from("edu_verifications")
      .update({ verified_at: nowIso })
      .eq("id", row.id);
    if (updateErr) throw updateErr;

    const { error: profileErr } = await supabaseService
      .from("profiles")
      .update({ edu_verified: true, edu_email: trimmedEmail })
      .eq("user_id", user.id);
    if (profileErr) throw profileErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
