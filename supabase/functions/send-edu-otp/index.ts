// Edu email OTP — send a 6-digit verification code to a .edu address.
// Deploy: supabase functions deploy send-edu-otp
// Required secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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

    const { email } = await req.json();
    if (typeof email !== "string" || !email.toLowerCase().trim().endsWith(".edu")) {
      return new Response(JSON.stringify({ error: "Please enter a valid .edu email." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const trimmedEmail = email.toLowerCase().trim();

    const { error: insertErr } = await supabaseService
      .from("edu_verifications")
      .insert({ user_id: user.id, email: trimmedEmail, code });
    if (insertErr) throw insertErr;

    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const emailHtml = `<!DOCTYPE html><html><body style="font-family:Helvetica,sans-serif;background:#FAF9F6;padding:40px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
  <h2 style="margin:0 0 16px;color:#0F172A;font-size:22px;">Your Tandem verification code</h2>
  <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">Enter this code in the app to verify your school email.</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0F172A;background:#F0FDFB;border:1px solid #2DD4BF;border-radius:12px;padding:20px;text-align:center;">${code}</div>
  <p style="color:#9CA3AF;font-size:13px;margin:24px 0 0;">Expires in 15 minutes. If you didn't request this, ignore the email.</p>
</div></body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: "Sunny from Tandem <sunny@thetandemweb.com>",
        reply_to: "tandemapp.hq@gmail.com",
        to: trimmedEmail,
        subject: `Your Tandem verification code is ${code}`,
        text: `Your Tandem verification code is ${code}. Expires in 15 minutes.`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend failed:", errBody);
      return new Response(JSON.stringify({ error: "couldn't send the code. try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
