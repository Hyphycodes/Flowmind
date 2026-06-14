import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { appUrl, stripeConfigured } from "@/lib/auth/config";
import { getPlan } from "@/lib/billing/plans";
import { ensureCustomer, createCheckoutSession } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/billing/types";

export const runtime = "nodejs";

/** Create a Stripe Checkout session for a plan. Returns a clear setup message (not a crash) when
 *  Stripe / the price id isn't configured. */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return Response.json({ error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY + plan price IDs to enable checkout." }, { status: 503 });
  }
  const user = await getCurrentUser();
  const sb = await getServerSupabaseAuth();
  if (!user || !sb) return Response.json({ error: "Not signed in" }, { status: 401 });

  let body: { planId?: PlanId; interval?: "monthly" | "yearly" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = getPlan(body.planId);
  const interval = body.interval === "yearly" ? "yearly" : "monthly";
  const priceId = interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
  if (plan.id === "free" || plan.id === "enterprise" || !priceId) {
    return Response.json({ error: "price_not_configured", message: `No Stripe price configured for ${plan.name} (${interval}).` }, { status: 503 });
  }

  try {
    const { data: existing } = await sb.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    const customerId = await ensureCustomer({ email: user.email, userId: user.id, existingId: existing?.stripe_customer_id });
    if (!existing) {
      await sb.from("billing_customers").upsert({ user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }
    const base = appUrl();
    const session = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${base}/settings/billing?checkout=success`,
      cancelUrl: `${base}/settings/billing?checkout=cancelled`,
      userId: user.id,
      planId: plan.id,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
