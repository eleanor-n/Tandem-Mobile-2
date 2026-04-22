// Stripe Webhook — handles subscription lifecycle events
// Deploy: npx supabase functions deploy stripe-webhook
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//
// STRIPE DASHBOARD SETUP:
// Stripe Dashboard → Developers → Webhooks → Add endpoint
// URL: https://ccntlaunczirvntnsjbm.supabase.co/functions/v1/stripe-webhook
// Events to listen for:
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted

import Stripe from "npm:stripe";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GO_PRICES = new Set([
  "price_1T6Xe1QtlSTTnULkTpBp1mxM",
  "price_1T6XqKQtlSTTnULkkkm1vB5D",
  "price_1T6XqQQtlSTTnULkHPrMv0Vo",
  "price_1T6XqRQtlSTTnULk9QguocAx",
]);
const TRAIL_PRICES = new Set([
  "price_1T6XiSQtlSTTnULkFUO91T1d",
  "price_1T6XqSQtlSTTnULk8FOPYTiK",
  "price_1T6XqTQtlSTTnULkwga3Xwr6",
  "price_1T6XqUQtlSTTnULkkCs6dJyP",
]);

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err: any) {
    console.error("webhook signature verification failed:", err.message);
    return new Response(`webhook error: ${err.message}`, { status: 400 });
  }

  const updateTier = async (customerId: string, tier: string) => {
    await supabase
      .from("profiles")
      .update({ membership_tier: tier, stripe_customer_id: customerId } as any)
      .eq("stripe_customer_id", customerId);
  };

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const customerId = sub.customer as string;
        const userId = sub.metadata?.supabase_user_id;

        let tier = "free";
        if (sub.status === "active" || sub.status === "trialing") {
          tier = TRAIL_PRICES.has(priceId) ? "trail" : GO_PRICES.has(priceId) ? "go" : "free";
        }

        if (userId) {
          await supabase
            .from("profiles")
            .update({ membership_tier: tier, stripe_customer_id: customerId } as any)
            .eq("user_id", userId);
        } else {
          await updateTier(customerId, tier);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = sub.metadata?.supabase_user_id;

        if (userId) {
          await supabase
            .from("profiles")
            .update({ membership_tier: "free" } as any)
            .eq("user_id", userId);
        } else {
          await updateTier(customerId, "free");
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("webhook processing error:", err.message);
    return new Response(`processing error: ${err.message}`, { status: 500 });
  }
});
