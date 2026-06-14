import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { appUrl, stripeConfigured } from "@/lib/auth/config";
import { createPortalSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/** Open the Stripe billing portal so the user can manage/cancel their subscription. */
export async function POST() {
  if (!stripeConfigured()) {
    return Response.json({ error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY to enable the billing portal." }, { status: 503 });
  }
  const user = await getCurrentUser();
  const sb = await getServerSupabaseAuth();
  if (!user || !sb) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data } = await sb.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (!data?.stripe_customer_id) {
    return Response.json({ error: "no_customer", message: "No billing account yet — subscribe to a plan first." }, { status: 409 });
  }
  try {
    const session = await createPortalSession({ customerId: data.stripe_customer_id, returnUrl: `${appUrl()}/settings/billing` });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
