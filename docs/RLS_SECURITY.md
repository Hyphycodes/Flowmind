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

## Before going public

1. Enable Supabase Auth (Google provider) + set `NEXT_PUBLIC_AUTH_ENABLED=true`.
2. Apply migration 0007.
3. Move the autosave write-path to the auth client so new pipelines stamp `user_id`.
4. Tighten to strict per-user policies (drop the null allowance).
5. Add rate limiting to `POST /api/pipelines/[id]/run`.
