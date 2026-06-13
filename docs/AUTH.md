# Flowmind — Auth

Accounts are **opt-in and config-gated**. By default Flowmind runs as a public demo (no login)
so the builder/templates work for everyone. Turn on accounts when you've configured the provider.

## Two separate Google concepts

- **Sign in with Google** = authentication (your Flowmind account). Does **not** give Flowmind
  your Drive.
- **Connect Google Drive** = a separate connected-account permission for files you select. See
  [GOOGLE_DRIVE_CONNECTOR.md](GOOGLE_DRIVE_CONNECTOR.md).

## Stack

Supabase Auth via `@supabase/ssr` (cookie sessions). Google OAuth + email magic link.

- `lib/supabase/browser.ts` — cookie-aware browser client (login/session/sign-out).
- `lib/supabase/serverClient.ts` — cookie-aware server client (Server Components + Route Handlers).
- `lib/auth/config.ts` — `authConfigured()`, `authEnabled()`, `googleDriveConfigured()`.
- `lib/auth/user.ts` — `getCurrentUser()` (server, never throws).
- Pages: `app/login`, `app/signup`, `app/account`, `app/onboarding`.
- Callback: `app/auth/callback/route.ts` (exchange code → ensure profile → onboarding).
- `app/api/auth/session` — sanitized current-user for client UI.

## Enable it

1. **Supabase dashboard → Authentication → Providers → Google**: enable, paste your Google
   OAuth client id/secret.
2. **Google Cloud Console → Credentials → OAuth client (Web)**: add the Supabase callback
   `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. Set env: `NEXT_PUBLIC_AUTH_ENABLED=true` (and `NEXT_PUBLIC_APP_URL`).
4. Apply migration `supabase/migrations/0007_auth_ownership.sql`.

When `NEXT_PUBLIC_AUTH_ENABLED` is unset/false, the sidebar shows the demo profile and login
pages show a "not enabled" notice — nothing breaks.

## Ownership

`profiles`, `connected_accounts`, and `google_drive_files` are user-owned (written via the
auth server client, RLS-enforced). `pipelines`/`datasets`/`takes` get a nullable `user_id`
and a transitional RLS policy (legacy/demo rows stay accessible; new rows are owner-only) —
see [RLS_SECURITY.md](RLS_SECURITY.md). Moving the autosave write-path to the auth client (so
new pipelines stamp `user_id`) is the next step once auth is live.
