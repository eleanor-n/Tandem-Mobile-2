// Restore Purchases — finds active Stripe subscription for a user and updates their tier
// Deploy: npx supabase functions deploy restore-purchases
// Required secrets: STRIPE_SECRET_KEY

import Stripe from "npm:stripe";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id } = await req.json();
    if (!user_id) return new Response("missing user_id", { status: 400, headers: corsHeaders });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find Stripe customer by supabase_user_id metadata
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id;

    // Fallback: search by metadata if no stored customer ID
    if (!customerId) {
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
      if (authUser?.user?.email) {
        const customers = await stripe.customers.list({ email: authUser.user.email, limit: 1 });
        customerId = customers.data[0]?.id ?? null;
      }
    }

    if (!customerId) {
      return new Response(JSON.stringify({ active_subscription: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ active_subscription: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sub = subscriptions.data[0];
    const priceId = sub.items.data[0]?.price.id;

    // Map price ID to tier
    const GO_PRICES = [
      "price_1T6Xe1QtlSTTnULkTpBp1mxM",
      "price_1T6XqKQtlSTTnULkkkm1vB5D",
      "price_1T6XqQQtlSTTnULkHPrMv0Vo",
      "price_1T6XqRQtlSTTnULk9QguocAx",
    ];
    const TRAIL_PRICES = [
      "price_1T6XiSQtlSTTnULkFUO91T1d",
      "price_1T6XqSQtlSTTnULk8FOPYTiK",
      "price_1T6XqTQtlSTTnULkwga3Xwr6",
      "price_1T6XqUQtlSTTnULkkCs6dJyP",
    ];

    const tier = TRAIL_PRICES.includes(priceId) ? "trail"
      : GO_PRICES.includes(priceId) ? "go"
      : "free";

    // Update profile
    await supabase
      .from("profiles")
      .update({ membership_tier: tier, stripe_customer_id: customerId } as any)
      .eq("user_id", user_id);

    return new Response(JSON.stringify({ active_subscription: true, tier, subscription_id: sub.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(`error: ${err.message}`, { status: 500, headers: corsHeaders });
  }
});
