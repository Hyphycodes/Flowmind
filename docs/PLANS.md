# Plans

Plan IDs are stable internal strings: `free | pro | studio | enterprise`. The catalog lives in
`lib/billing/plans.ts` — **config-driven**, with prices + Stripe price IDs read from env so nothing
is hardcoded to one Stripe account. `PlanLimits` + `PlanFeature[]` are the source of truth for
feature gates.

| Plan        | For              | Credits/mo | Highlights                                                        |
| ----------- | ---------------- | ---------- | ----------------------------------------------------------------- |
| **Free**    | discovery/demos  | 200        | 3 pipelines, 25 runs, 5 exports, developer export, no GitHub PR   |
| **Pro**     | solo builders    | 5,000      | 1k runs, GitHub PR export, Drive connector, client/founder export |
| **Studio**  | agencies/teams   | 20,000     | team workspace, branded + private templates, higher limits        |
| **Enterprise** | larger orgs   | 100,000    | custom limits, SSO, BYOK, self-host, audit logs (contact sales)   |

Prices are illustrative defaults (`monthlyPriceCents` / `yearlyPriceCents`) and only become
purchasable when the matching `STRIPE_PRICE_*` env var is set. Free is included; Enterprise is
"contact sales" (no self-serve checkout).

## Features (`PlanFeature`)

`templates`, `real_ai_runs`, `input_studio`, `developer_export`, `client_blueprint`,
`founder_brief`, `github_pr_export`, `google_drive_connector`, `team_workspace`, `branded_exports`,
`private_template_library`, `byok`, `advanced_evals`, `priority_support`, `self_hosting`.

## Limits (`PlanLimits`)

`savedPipelines`, `realRunsPerMonth`, `inputStudioRowsPerMonth`, `exportsPerMonth`,
`githubPrExportsPerMonth`, `connectedAccounts`, `datasetRowsStored`, `takesPerPipeline`,
`teamMembers`, `maxTeamNodesPerPipeline`, `maxAgentsPerTeam`, `maxRunTraceRetentionDays`. Any value
may be a number or `"unlimited"`.

## Where plans surface

- **Sidebar** — `UsageMeter` (plan name, credits, runs, exports, reset date).
- **Settings → Billing** (`/settings/billing`) — current plan, usage stats, plan grid, manage
  billing, BYOK card.
- **Pricing** (`/pricing`) — public plan grid with monthly/yearly toggle.
- **Upgrade modal** — shown when a gate blocks an action.

## Workspace billing

Schema supports `workspace_id` throughout. Free/Pro bill at the user level; Studio is intended to
bill at the workspace level with the owner managing billing and members consuming shared credits.
User-level billing is implemented first; workspace rollups can layer on without schema changes.
