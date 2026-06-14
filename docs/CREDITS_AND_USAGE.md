# Credits, Usage & BYOK

## Credits are the unit

Different actions cost different amounts, so Flowmind uses **credits** (not raw dollars). Credit
calculation is **deterministic and config-driven** (`lib/billing/credits.ts`) — it does not rely
only on provider cost. Tune the numbers in `CREDIT_COST`.

| Action                       | Cost (default)                                  |
| ---------------------------- | ----------------------------------------------- |
| Model call (cheap → expensive)| 1 → 5 credits, by the model's `costTier`        |
| Tool / API call              | 1 credit                                        |
| Input Studio row             | 0.2 (0.4 premium) credit/row                    |
| AI export doc regeneration   | 8 credits/doc (client blueprint / founder brief)|
| GitHub PR export             | 2 credits                                       |
| Product Drop / Remix         | 3 credits                                        |
| Eval run                     | 1 credit                                         |

Plain deterministic ZIP files (developer/runtime) are free — only AI-generated docs cost credits.

### Estimating before you run

`estimateCreditsForRun(pipeline)`, `estimateCreditsForInputStudio(config)`, and
`estimateCreditsForExport(modes, ctx)` return a `CreditEstimate` (`credits`, `breakdown[]`,
`warnings[]`). The estimate API — `POST /api/billing/credits/estimate` — also returns the matching
**feature-gate decision**, so the client can show "Estimated: 42 credits" and decide whether to
warn/block before running. The `CreditEstimate` component (TopBar + Export dialog) renders this and
self-hides when billing is off or the cost is zero.

### Cost-trace integration

Prompt 05's run cost/latency trace feeds billing: if token usage is known we convert it to credits
(`creditsFromCostEstimate`), otherwise we fall back to the per-call tier estimate. We **never invent
exact dollar costs**.

## Usage logging

Server-side, best-effort, and a no-op when billing is off:

- `logCreditEvent(...)` → `credit_events` ledger + bumps `usage_counters.creditsSpent`.
- `logUsageEvent(...)` → `usage_events` (model/team/agent/export/tool analytics).
- `incrementUsageCounter(name, by)` → `usage_counters` (realRuns, exports, githubPrExports, inputStudioRows).
- `recordRunSpend(...)` → spend + run count after a run completes.

Counters are keyed by `(user_id, workspace_id, period_start)` so the monthly window resets
automatically — a new calendar month means fresh counters and a fresh grant.

## Balance model

There's no separate balance table. For the current period:

```
balance = plan.includedCredits + purchasedCredits - creditsSpent
monthlyGrantRemaining = max(0, plan.includedCredits - creditsSpent)
```

`getBillingAccount()` builds this from `subscriptions` (plan) + `usage_counters` (spend/purchases),
returning a generous default when billing is off, unauthenticated, or the tables aren't migrated.

## BYOK (Bring Your Own Key)

Architecture is in place; the add-key flow opens on **Enterprise**:

- `user_model_keys` table (migration `0009`) stores **encrypted key references only** — never
  plaintext, never sent to the client or exported.
- `UserModelKey` type in `lib/billing/types.ts`.
- Settings → Billing shows a represented (disabled) "Model Keys (BYOK)" card — we never ask for a
  real key until per-provider encryption is wired.

BYOK reduces Flowmind's model-cost burden but still respects plan limits. Workspace-scoped on team
plans.

## Abuse / rate limits

Plan limits double as basic protection: `realRunsPerMonth`, `inputStudioRowsPerMonth`,
`maxAgentsPerTeam`, `exportsPerMonth`. Heavy-run soft warnings nudge toward cheaper models. Add
finer per-minute limits later if needed — kept simple for now.
