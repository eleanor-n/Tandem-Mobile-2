// Stripe Checkout Session — Supabase Edge Function
// Deploy: supabase functions deploy create-checkout-session
// Required secrets: STRIPE_SECRET_KEY

import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, userId, userEmail } = await req.json();

    if (!priceId || !userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: "Missing priceId, userId, or userEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up existing customer by email or create a new one
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    const customer = existingCustomers.data.length > 0
      ? existingCustomers.data[0]
      : await stripe.customers.create({
          email: userEmail,
          metadata: { supabase_user_id: userId },
        });

    // Create checkout session with 7-day free trial
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: userId },
      },
      success_url: "https://thetandemweb.com/subscription?status=success",
      cancel_url: "https://thetandemweb.com/subscription?status=cancel",
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
