# Audit & Governance (Prompt 07b)

What lets a company say "yes" to Flowmind. Builds on Task 07 workspaces. Opt-in per workspace,
default off so a solo user is never slowed. No fabricated compliance/certification claims anywhere.

## Immutable audit log

- `audit_log` (migration `0017`) is **append-only and tamper-evident at the RLS level**: admins of
  the workspace may `select`; there is **no** insert/update/delete policy for anon/authenticated, so
  only the service-role server (`recordAudit`) can write and nobody can edit or delete entries.
- `lib/governance/audit.ts → recordAudit(...)` is the single, central helper. Wired into the
  server mutating paths: `run.completed` (`/api/run`), `trigger.fired` (`lib/automation/fire.ts`),
  `export.generated` (`/api/github/export`). Extending coverage to shares/members is the same
  one-liner from those mutation paths.
- The audit viewer (`/workspace/governance`) is a read-only, filterable timeline with **CSV export**.

## Spend limits + budgets

- Per-workspace monthly budget (`workspace_governance.monthly_budget_usd`) and an optional per-member
  cap (`workspace_members.monthly_budget_usd`).
- **Enforced server-side** in `/api/run` via `lib/governance/enforce.ts → checkRunGovernance`: if the
  workspace's month-to-date spend (summed from run trace costs) is at/over budget, the run is blocked
  with a clear reason; a warning is surfaced at 80%. No-op without a workspace/config.
- Owner/admin sees spend broken down by pipeline (and the total vs budget) on the governance page.

## Approval gates

- Opt-in per workspace (`require_approval`): expensive runs (`deep_run` above a cost threshold),
  exports, public-link shares, attaching pricing.
- Flow: a gated action creates a pending `approval_requests` row; an admin approves/denies on the
  governance page; the run path checks for an approval before proceeding. Decisions are audited.
  Currently enforced for `deep_run` in `/api/run` (estimated cost ≥ threshold); the other gates are
  configurable and enforced at their action's server path.

## Governance posture

A one-screen summary on `/workspace/governance` (audit on, budget set, gates configured) — the
honest artifact a prospective customer's security team asks for. Nothing claims a certification.

## Setup

Apply `0017_governance.sql` (after `0015` workspaces). Enforcement needs `SUPABASE_SERVICE_ROLE_KEY`
so the server can write the audit log + entitlement-style records and read governance config.
Everything no-ops in the public demo (no workspace), so individuals aren't impeded.
