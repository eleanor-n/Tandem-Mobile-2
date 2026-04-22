// Update Subscription — upgrades or downgrades an existing Stripe subscription
// Deploy: npx supabase functions deploy update-subscription
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
    const { user_id, new_price_id } = await req.json();
    if (!user_id || !new_price_id) {
      return new Response("missing user_id or new_price_id", { status: 400, headers: corsHeaders });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: "no customer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ error: "no active subscription" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription = subscriptions.data[0];
    const itemId = subscription.items.data[0].id;

    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: itemId, price: new_price_id }],
      proration_behavior: "create_prorations",
    });

    return new Response(JSON.stringify({ success: true, subscription_id: updated.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(`error: ${err.message}`, { status: 500, headers: corsHeaders });
  }
});
