# Beta Readiness

The verdict from the Prompt 12 hardening pass, plus what to watch.

## What's hardened

- **Secrets**: provider/Stripe/service-role keys and OAuth/App tokens are server-only, encrypted
  where stored, redacted in errors, and excluded from exports. `npm run audit:secrets` is clean.
- **RLS**: per-user policies on all account/connector/billing tables (0007–0009). Demo data is
  null-owned and isolated; private data needs a session. Test SQL in `docs/RLS_SECURITY.md`.
- **API guards**: shared `lib/api/guards.ts` (`requireUser`, `validateJsonBody`,
  `requirePipelineAccess`, `safeApiError`). Connected-account + billing routes verify ownership.
- **Export safety**: one shared scanner runs before ZIP *and* GitHub PR export.
- **Billing**: server-enforced gates; Stripe webhook signature-verified; clients can't self-grant
  credits.
- **Connectors**: Google/GitHub login separate from resource access; disconnect/reconnect/not-
  configured states all degrade cleanly.
- **Readiness panel**: `/settings/readiness` shows live pass/warn/fail per subsystem.

## Public-demo verdict

**Safe to beta as a public demo.** Unauthenticated users get the canvas, templates, deterministic
runs, and ZIP export. Accounts, connectors, GitHub PR export, and (when enabled) billing all
require sign-in and are gated server-side.

## Remaining risks (track before/early in beta)

1. **Transitional RLS** — pipelines/datasets/takes still allow null-owned (demo) rows. Tighten to
   strict per-user once the autosave path stamps `user_id` and demo rows are migrated.
2. **Hosted run rate limiting** — `POST /api/pipelines/[id]/run` is portable/unauthenticated by
   design (reads only null-owned/template pipelines under RLS). Add rate limiting before promoting
   it as a public API.
3. **Stripe live testing** — webhook/checkout verified structurally; run a real test-mode
   transaction before charging.
4. **Per-minute abuse limits** — plan limits gate monthly volume; add short-window throttling for
   runs/Input Studio if abuse appears.
5. **Workspace billing** — schema supports `workspace_id`; team rollups not yet wired.

## Pre-launch steps

See `docs/PRODUCTION_CHECKLIST.md` and run `/settings/readiness`.
