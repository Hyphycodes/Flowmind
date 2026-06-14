# Stripe Setup

Flowmind talks to Stripe via the REST API (`lib/billing/stripe.ts`) — no SDK dependency — and
verifies webhook signatures with node crypto. The **secret key is server-only** and never reaches
the client.

## 1. Env vars

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_STUDIO_MONTHLY=price_...
STRIPE_PRICE_STUDIO_YEARLY=price_...
# optional one-time credit packs
STRIPE_PRICE_CREDITS_SMALL=
STRIPE_PRICE_CREDITS_MEDIUM=
STRIPE_PRICE_CREDITS_LARGE=
```

Also set `NEXT_PUBLIC_BILLING_ENABLED=true`, `NEXT_PUBLIC_AUTH_ENABLED=true`, and
`SUPABASE_SERVICE_ROLE_KEY` (the webhook writes via the service-role client). Apply migration
`0009_billing.sql`.

When `STRIPE_SECRET_KEY` is missing, checkout/portal routes return a **clear setup message (503),
never a crash**, and plan CTAs render a disabled "Setup required" state.

## 2. Products & prices

Create a product per paid plan (Pro, Studio) with monthly + yearly prices, then paste the price IDs
into the env vars above. Plan ↔ price mapping is automatic via `lib/billing/plans.ts`.

## 3. Webhook

Add an endpoint pointing at `POST /api/billing/webhook` and copy its signing secret into
`STRIPE_WEBHOOK_SECRET`. Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The handler **verifies the `stripe-signature` header** (HMAC-SHA256 over `t.payload`, 5-min
tolerance) before trusting the body, then upserts the `subscriptions` row (plan, status, period,
cancel-at-period-end) via the service-role client.

Local testing:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
stripe trigger checkout.session.completed
```

## 4. Flow

1. User picks a plan → `POST /api/billing/checkout` creates (or reuses) a Stripe customer and a
   Checkout session, returns the URL, client redirects.
2. On success Stripe fires the webhook → subscription synced → `getBillingAccount()` reflects the
   new plan → gates + usage meter update.
3. **Manage billing** → `POST /api/billing/portal` opens the Stripe billing portal.

## Credit packs / top-ups

Schema-ready (one-time `credit_purchase` credit events update the balance). The price IDs exist in
env; the checkout one-time-payment path can be enabled later. Not wired in this pass.
