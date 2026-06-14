# Billing

Flowmind's business layer: plans, credits, usage, feature gates, and Stripe. Designed to be
**product-native and calm** — soft limits, clear usage cards, upgrade prompts at high-value
moments. Not a bloated SaaS billing maze.

## Off by default

Billing is gated by `NEXT_PUBLIC_BILLING_ENABLED`. When **off** (the default), the public demo
runs **unlimited/free**: all feature gates allow, no credits are charged, the usage meter shows a
calm "billing off · unlimited preview" note. Flip it to `true` to enforce plan limits + credit
gating.

```
NEXT_PUBLIC_BILLING_ENABLED=true
```

Billing also requires auth (`NEXT_PUBLIC_AUTH_ENABLED=true`, migration `0007`) and the billing
migration `0009`.

## Pieces

| Concern         | Where                                                       |
| --------------- | ----------------------------------------------------------- |
| Plan catalog    | `lib/billing/plans.ts` (config-driven, prices from env)     |
| Credit math     | `lib/billing/credits.ts` (deterministic, tunable)           |
| Feature gates   | `lib/billing/featureGates.ts` (**all** plan checks live here)|
| Usage + balance | `lib/billing/usage.ts` (server, best-effort, degrades)      |
| Stripe          | `lib/billing/stripe.ts` (REST + webhook sig verify)         |
| Types           | `lib/billing/types.ts`                                       |
| UI              | `components/billing/*`                                       |
| Pages           | `/settings/billing`, `/pricing`                             |
| Routes          | `app/api/billing/*`                                          |

## Feature gates (centralized)

Never scatter plan checks. Every gate is in `lib/billing/featureGates.ts` and returns a
`FeatureGateResult` (`allowed`, `reason`, `planRequired`, `creditsRequired/Available`,
`upgradeCta`, `softWarning`). Gates:

- `canRunPipeline(account, estimate)` — real AI runs (feature + run limit + credit balance)
- `canCreateDatasetRows(account, rowCount)` — Input Studio rows
- `canExport(account, mode)` — exports by plan + count
- `canCreateGitHubPr(account)` — GitHub PR export
- `canUseFeature(account, feature)` / `canSavePipeline(...)`

When billing is off, every gate returns `{ allowed: true }`.

## Where gating is applied

| Action            | Route                          | Gate / logging                                   |
| ----------------- | ------------------------------ | ------------------------------------------------ |
| Real AI run       | `app/api/run/route.ts`         | `canRunPipeline` (402 → upgrade modal); `recordRunSpend` on success |
| Input Studio      | `app/api/input-studio/route.ts`| `canCreateDatasetRows`; logs credits + rows      |
| GitHub PR export  | `app/api/github/export/route.ts`| `canCreateGitHubPr`; counts export + PR credits  |
| ZIP export        | Export dialog (`CreditEstimate`)| advisory estimate; basic ZIP is always available |

A 402 with a `gate` body opens the **Upgrade modal** (`components/billing/UpgradeModal.tsx`) via
the store, which always offers a non-paywall path ("Download ZIP instead").

## Hard vs soft limits

- **Hard** (block): out of credits, feature not in plan, monthly limit reached. → upgrade modal.
- **Soft** (warn, never block): heavy run, nearing balance, many agents. → `softWarning` shown
  inline / in the credit estimate.

## Never

- Expose `STRIPE_SECRET_KEY` (server-only; webhook uses the service-role client).
- Invent exact provider dollar costs — **credits** are the user-facing abstraction.
- Skip webhook signature verification (`verifyAndParseWebhook`).
- Gate basic demo/template viewing.
- Hardcode plan logic outside `featureGates.ts`.

See [CREDITS_AND_USAGE.md](CREDITS_AND_USAGE.md), [PLANS.md](PLANS.md), [STRIPE_SETUP.md](STRIPE_SETUP.md).
