# Security Model

Flowmind's security posture, consolidated. The guiding principle: **fail cleanly, never leak**.

## Secrets never reach the client

- AI/provider keys, Stripe secret, Supabase service-role key, OAuth tokens, and the GitHub App
  private key are **server-only**. They are read inside Route Handlers (`runtime = "nodejs"`),
  never imported into client components, never sent in any response, and never exported.
- Status routes (`/api/status`, `/api/providers/status`, `/api/tools/status`,
  `/api/google/status`, `/api/github/status`, `/api/billing/status`) return **booleans + missing
  env var NAMES** only — never values.
- OAuth tokens are AES-256-GCM encrypted at rest (`FLOWMIND_TOKEN_ENCRYPTION_SECRET`,
  `lib/auth/tokens.ts`). GitHub uses no stored token at all — installation tokens are minted on
  demand and discarded.
- Error messages are passed through `safeApiError` / `redactSecrets` (`lib/security/secrets.ts`)
  so a thrown provider error can never echo a key back to the user.

## API route guards

Shared helpers in `lib/api/guards.ts`: `requireUser`, `validateJsonBody`, `requirePipelineAccess`,
`safeApiError`, `jsonError`. Connected-account routes (Google/GitHub) validate the session and
that the resource belongs to the user's connection before any read/write. Expensive routes (run,
Input Studio, GitHub PR) run server-side credit/feature gates (see `docs/BILLING.md`).

## RLS / data ownership

Per-user RLS on all account/connector/billing tables (migrations 0007–0009). Pipelines/datasets/
takes use a transitional policy so public-demo rows (null owner) stay readable. Full detail +
test SQL: `docs/RLS_SECURITY.md`.

## Export safety

A single shared scanner (`lib/security/secrets.ts`) runs before **both** the ZIP download
(`createExportBundle`) and the GitHub PR export. It blocks private-key blocks, provider/Stripe/
GitHub tokens, service-role JWTs, and `.env.local` files; `.env.example` (empty placeholders) is
allowed. Detail: `docs/EXPORT_SECURITY.md`.

## Billing integrity

Plan/credit checks are **server-enforced** — the client cannot grant itself credits or bypass a
gate. The Stripe webhook verifies the `stripe-signature` HMAC before trusting any payload and is
the only path that writes via the service-role client. Detail: `docs/BILLING.md`.

## Public demo isolation

The app runs unauthenticated as a public demo. Demo writes hit null-owned rows only; private user
data requires a session. Connecting accounts, pushing PRs, and (when billing is on) heavy runs all
require sign-in. See `docs/BETA_READINESS.md`.

## Tooling

- `npm run audit:secrets` — scans tracked files for committed credentials + verifies `.env*` is
  ignored (CI-friendly, exits non-zero on a finding).
- `/settings/readiness` — live configuration/safety self-check (config booleans only).
