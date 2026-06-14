import { createHmac, timingSafeEqual } from "node:crypto";

/** Minimal Stripe client — SERVER ONLY. Uses the REST API via fetch (form-encoded) so we don't
 *  add an SDK dependency, and verifies webhook signatures with node crypto. The Stripe secret
 *  key never reaches the client. */

const STRIPE_API = "https://api.stripe.com/v1";

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  return key;
}

/** Flatten a nested object into Stripe's bracketed form-encoding (`a[b][c]=v`). */
function toForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      parts.push(...toForm(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") parts.push(...toForm(item as Record<string, unknown>, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts;
}

async function stripeFetch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? toForm(body).join("&") : undefined,
  });
  if (!res.ok) throw new Error(`Stripe ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Find-or-create a Stripe customer for a user (idempotent on email + metadata). */
export async function ensureCustomer(input: { email?: string | null; userId: string; existingId?: string | null }): Promise<string> {
  if (input.existingId) return input.existingId;
  const customer = await stripeFetch<{ id: string }>("/customers", {
    email: input.email ?? undefined,
    metadata: { flowmind_user_id: input.userId },
  });
  return customer.id;
}

export async function createCheckoutSession(input: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  mode?: "subscription" | "payment";
  userId: string;
  planId: string;
}): Promise<{ id: string; url: string | null }> {
  return stripeFetch<{ id: string; url: string | null }>("/checkout/sessions", {
    customer: input.customerId,
    mode: input.mode ?? "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: input.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { flowmind_user_id: input.userId, flowmind_plan_id: input.planId },
    subscription_data: input.mode === "payment" ? undefined : { metadata: { flowmind_user_id: input.userId, flowmind_plan_id: input.planId } },
  });
}

export async function createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
  return stripeFetch<{ url: string }>("/billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

/** Verify a Stripe webhook signature (`t=…,v1=…`) without the SDK. Returns the parsed event or
 *  throws. Tolerance defaults to 5 minutes. */
export function verifyAndParseWebhook(payload: string, sigHeader: string | null, toleranceSec = 300): unknown {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  if (!sigHeader) throw new Error("Missing stripe-signature header.");

  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) throw new Error("Malformed stripe-signature.");

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Signature verification failed.");

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Number.isFinite(age) && age > toleranceSec) throw new Error("Webhook timestamp outside tolerance.");

  return JSON.parse(payload);
}
