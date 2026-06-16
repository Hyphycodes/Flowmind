import { getShareByToken } from "@/lib/sharing/server";
import { getPricing, hashRef } from "@/lib/sharing/monetization";
import { createShareCheckoutSession } from "@/lib/billing/stripe";
import { appUrl, stripeConfigured } from "@/lib/auth/config";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";

/** Start checkout for a priced Run-App (Task 05b). The requester needs no account — they pay by
 *  email; the webhook mints their entitlement on success. Server enforces the price + token. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!stripeConfigured()) {
    return Response.json({ error: "Payments aren't set up for this app yet." }, { status: 503 });
  }
  const { token } = await params;
  const share = await getShareByToken(token);
  if (!share) return Response.json({ error: "This share link is not valid." }, { status: 404 });

  const pricing = getPricing(share);
  if (pricing.mode === "free") return Response.json({ error: "This app is free to run." }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const email = typeof (body as { requesterEmail?: unknown }).requesterEmail === "string"
    ? (body as { requesterEmail: string }).requesterEmail.trim()
    : "";
  if (!email || !/\S+@\S+/.test(email)) return Response.json({ error: "Enter a valid email to pay." }, { status: 400 });

  const base = appUrl();
  try {
    const session = await createShareCheckoutSession({
      amountUsd: pricing.amountUsd,
      currency: pricing.currency,
      mode: pricing.mode,
      customerEmail: email,
      successUrl: `${base}/run/${token}?paid=1`,
      cancelUrl: `${base}/run/${token}?cancelled=1`,
      productName: "Flowmind app access",
      metadata: { flowmind_share_id: share.id, flowmind_requester_ref: hashRef(email), flowmind_share_mode: pricing.mode },
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Couldn't start checkout.") }, { status: 500 });
  }
}
