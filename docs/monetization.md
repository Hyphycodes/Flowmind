# Run-App monetization (Prompt 05b)

Turn a shared Run-App into a business: see who's using it, and **charge for access**. Builds on
Task 05 (hosted Run-Apps) and the existing Stripe billing — no parallel billing system.

## What ships now

- **Usage attribution** — every Run-App execution writes a `share_runs` row (status, duration,
  cost, input *keys*, hashed requester ref, runId). Migration `0016`.
- **Owner analytics** — the Share modal shows runs, success rate, total cost, and busiest inputs
  for a share. Runs are also saved to the owner's run history so failing traces are inspectable.
- **Pricing** — a `run` share can be **free**, **per-run**, or a monthly **subscription**
  (`share.pricing`). Set it in the Share modal.
- **Server-enforced paywall** — `POST /api/run-app/[token]` checks an **entitlement** before
  executing a priced share (402 → the Run-App shows a paywall). The stripped, results-only
  execution from Task 05 is intact: paying to run still never exposes prompts or data.
- **Entitlements** — `share_entitlements` is **only writable by the trusted server** (the Stripe
  webhook via the service role). A client can never forge one. Per-run entitlements carry credits
  (decremented each run); subscriptions carry an active period. Checked server-side every run.
- **Checkout + webhook** — `POST /api/run-app/[token]/checkout` opens a dynamic-price Stripe
  Checkout (the requester pays by email, no Flowmind account needed); `checkout.session.completed`
  on the existing `/api/billing/webhook` mints the entitlement. The requester returns to the
  Run-App and runs.

## Payouts — Stripe Connect (stubbed, not faked)

Charging *on behalf of owners* means routing funds to them, not just the platform. Full **Stripe
Connect (Express)** onboarding + transfers is the next step. Today, payments are **platform-
collected** against the existing Stripe account, and the owner-payout step is shown as a clearly
labeled **"Owner payouts (Stripe Connect) coming soon"** state in the Share modal. Nothing fakes a
payout that doesn't happen.

To complete Connect:

1. Create Express accounts at owner onboarding (`/account` or billing settings) and store the
   `stripe_account_id` on the owner's billing record.
2. In `createShareCheckoutSession`, add `payment_intent_data.application_fee_amount` +
   `transfer_data.destination = <owner stripe_account_id>` (and `on_behalf_of`) so funds settle to
   the owner with an optional platform fee.
3. Handle `account.updated` to reflect payout-readiness; surface revenue per Run-App to the owner.

## Privacy

- Requesters are stored as a salted hash (`hashRef`), never raw PII.
- Input **keys** are recorded by default; input **values** only when the owner opts in
  (`pricing.captureInputValues`), which should be paired with a notice on the app.

## Setup

Apply migration `0016_runapp_monetization.sql`. Monetization needs `STRIPE_SECRET_KEY` +
`STRIPE_WEBHOOK_SECRET` (existing) and `SUPABASE_SERVICE_ROLE_KEY` (so the webhook can write
entitlements — the paywall boundary). Without these, shares stay free and analytics read-only.
