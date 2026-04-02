Deno.serve(async (req) => {
  try {
    const { email, name } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', sans-serif; background: #FAF9F6; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #2DD4BF, #3B82F6); padding: 40px; text-align: center; }
    .header h1 { color: white; font-size: 28px; margin: 0; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 36px 40px; }
    .body p { color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
    .highlight { background: #F0FDFB; border-left: 3px solid #2DD4BF; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .footer { padding: 24px 40px; border-top: 1px solid #F3F4F6; text-align: center; }
    .footer p { color: #9CA3AF; font-size: 12px; line-height: 1.6; }
    .btn { display: inline-block; background: linear-gradient(135deg, #2DD4BF, #3B82F6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 100px; font-weight: 700; font-size: 15px; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>you're in.</h1>
      <p>welcome to tandem</p>
    </div>
    <div class="body">
      <p>hi${name ? ` ${name}` : ""}. i'm Sunny — the heartbeat of Tandem.</p>
      <p>i'm basically that one friend who always has plans, never lets you bail, and somehow makes everything more fun just by showing up. and you just made an account. which means you get it.</p>
      <div class="highlight">
        <p style="margin:0; font-style: italic;">"never go alone. the activity is the icebreaker. the companion is the memory."</p>
      </div>
      <p>you know the feeling of wanting to go somewhere — a hike, a show, a coffee spot, a random tuesday adventure — and not wanting to go alone. that's exactly why tandem exists.</p>
      <p>post what you want to do. someone shows up for it. no pressure, no awkward energy, no group chat that goes nowhere.</p>
      <p>just quality companionship, an activity, and the start of something good.</p>
      <p style="text-align:center; margin-top: 32px;">
        <a href="https://thetandemweb.com" class="btn">open tandem</a>
      </p>
    </div>
    <div class="footer">
      <p>with love and zero chill,<br><strong>Sunny</strong>, the heartbeat of Tandem</p>
      <p>tandem · thetandemweb.com · tandemapp.hq@gmail.com<br>you're receiving this because you just joined tandem. no spam, ever.</p>
    </div>
  </div>
</body>
</html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Sunny from Tandem <sunny@thetandemweb.com>",
        reply_to: "tandemapp.hq@gmail.com",
        to: [email],
        subject: "you're in. welcome to tandem.",
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
