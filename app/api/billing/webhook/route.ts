import { stripeConfigured, stripeWebhookConfigured } from "@/lib/auth/config";
import { verifyAndParseWebhook } from "@/lib/billing/stripe";
import { getServiceSupabase } from "@/lib/billing/serviceClient";
import { PLANS } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/billing/types";

export const runtime = "nodejs";

/** Stripe webhook. Verifies the signature, then syncs subscription status + plan into Supabase
 *  via the service-role client. Never trusts the body without verification. */
function planIdFromPriceId(priceId?: string | null): PlanId | null {
  if (!priceId) return null;
  for (const p of Object.values(PLANS)) {
    if (p.stripePriceIdMonthly === priceId || p.stripePriceIdYearly === priceId) return p.id;
  }
  return null;
}

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
  metadata?: Record<string, string>;
};

export async function POST(req: Request) {
  if (!stripeConfigured() || !stripeWebhookConfigured()) {
    return Response.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = verifyAndParseWebhook(payload, sig) as typeof event;
  } catch (err) {
    return Response.json({ error: "invalid_signature", message: (err as Error).message }, { status: 400 });
  }

  const sb = getServiceSupabase();
  if (!sb) return Response.json({ received: true, note: "no service client — not persisted" });

  const syncSubscription = async (sub: StripeSubscription) => {
    const planId =
      planIdFromPriceId(sub.items?.data?.[0]?.price?.id) ?? (sub.metadata?.flowmind_plan_id as PlanId) ?? "pro";
    const userId = sub.metadata?.flowmind_user_id;
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data } = await sb.from("billing_customers").select("user_id").eq("stripe_customer_id", sub.customer).maybeSingle();
      resolvedUserId = data?.user_id ?? undefined;
    }
    if (!resolvedUserId) return;
    await sb.from("subscriptions").upsert(
      {
        user_id: resolvedUserId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer,
        plan_id: sub.status === "canceled" ? "free" : planId,
        status: sub.status,
        current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );
  };

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as unknown as StripeSubscription);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as { customer?: string; subscription?: string; metadata?: Record<string, string> };
        if (session.subscription && session.customer && session.metadata?.flowmind_user_id) {
          await sb.from("billing_customers").upsert(
            { user_id: session.metadata.flowmind_user_id, stripe_customer_id: session.customer, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed":
        // Status changes arrive via subscription.updated; nothing extra to persist here.
        break;
      default:
        break;
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  return Response.json({ received: true });
}
