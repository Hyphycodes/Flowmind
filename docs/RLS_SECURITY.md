# Flowmind — RLS & Security

## Current state

The V1 prototype shipped with **permissive** RLS (single-user, no auth). Prompt 09 adds the
ownership model in `supabase/migrations/0007_auth_ownership.sql` — **apply it only after
enabling auth**.

## Transitional model (migration 0007)

- New tables (`profiles`, `workspaces`, `workspace_members`, `connected_accounts`,
  `google_drive_files`) are **strictly user-owned**: `using (... = auth.uid())`.
- Existing tables (`pipelines`, `datasets`, `takes`, `runs`, `exports`) get a nullable
  `user_id` and a **transitional** policy:
  `user_id is null OR user_id = auth.uid()` (+ `is_template = true` public-read for pipelines).
  This lets legacy/demo rows keep working while new rows become owner-only.
- Once all rows have owners, **drop the `user_id is null` allowance** for a strict per-user model.

## Token security

- OAuth tokens are AES-256-GCM encrypted (`FLOWMIND_TOKEN_ENCRYPTION_SECRET`) and stored in
  `connected_accounts`. The `*_encrypted` columns are never selected client-side, never returned
  by `/api/google/status`, and never exported.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (never imported into the client bundle).

## Client vs server

- Browser uses the anon/publishable key only.
- Token usage + connected-account reads happen in Route Handlers behind a verified session
  (`getCurrentUser()`).

## Strictly user-owned tables (migrations 0008–0009)

These are **owner-only from creation** — `using (user_id = auth.uid())`, no null allowance:

- GitHub (0008): `github_connections`, `github_exports`, `github_repo_cache`.
- Billing (0009): `billing_customers`, `subscriptions`, `credit_events`, `usage_counters`,
  `usage_events`, `user_model_keys`.

The Stripe **webhook** writes via the service-role client (`lib/billing/serviceClient.ts`) — the
only path that bypasses RLS, and it runs only after signature verification. Users can never grant
themselves credits from the client: `credit_events` is owner-scoped and the balance is *derived*
server-side from the ledger, never trusted from the browser.

## RLS test SQL (run in the Supabase SQL editor as a signed-in user)

```sql
-- 1) Cannot see another user's connection metadata / billing:
select count(*) from github_connections where user_id <> auth.uid();      -- expect 0
select count(*) from subscriptions   where user_id <> auth.uid();         -- expect 0
select count(*) from credit_events   where user_id <> auth.uid();         -- expect 0
-- 2) Templates are publicly readable; other users' private pipelines are not:
select count(*) from pipelines where is_template = true;                  -- > 0 ok
select count(*) from pipelines where user_id is not null and user_id <> auth.uid(); -- expect 0
```

A non-zero count for rows you don't own means a policy is too permissive.

## Before going public

1. Enable Supabase Auth (Google provider) + set `NEXT_PUBLIC_AUTH_ENABLED=true`.
2. Apply migrations 0007 → 0008 → 0009 (in order).
3. Move the autosave write-path to the auth client so new pipelines stamp `user_id`.
4. Tighten to strict per-user policies (drop the `user_id is null` allowance on pipelines/
   datasets/takes once demo rows are migrated or removed).
5. Add rate limiting to `POST /api/pipelines/[id]/run` (portable/unauthenticated by design — it
   can only read null-owned/template pipelines via the anon client under RLS).
6. Run `npm run audit:secrets` and the RLS test SQL above.
