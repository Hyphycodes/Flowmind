# Production Checklist

Run through this before exposing Flowmind publicly. `/settings/readiness` automates the
configuration checks; this is the full manual list.

## Secrets & env

- [ ] `npm run audit:secrets` passes (no committed credentials; `.env*` ignored).
- [ ] All `*_SECRET` / `*_KEY` set in Vercel as **unexposed** server env (only `NEXT_PUBLIC_*` are
      public).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only and never referenced by client code.
- [ ] `FLOWMIND_TOKEN_ENCRYPTION_SECRET` is a strong random value (required before OAuth connect).

## Auth & RLS

- [ ] `NEXT_PUBLIC_AUTH_ENABLED=true` and the Supabase Google provider is enabled.
- [ ] Migrations `0001`→`0009` applied in order.
- [ ] RLS test SQL (`docs/RLS_SECURITY.md`) returns 0 for other users' rows.
- [ ] Autosave write-path stamps `user_id`; consider dropping the transitional null allowance.

## API routes

- [ ] Connected-account routes require a session; resource ownership validated.
- [ ] Expensive routes (run / Input Studio / GitHub PR) gated server-side (when billing on).
- [ ] Stripe webhook signature verification confirmed (send a test event).
- [ ] No route returns a secret value; errors pass through `safeApiError`.
- [ ] Add rate limiting to `POST /api/pipelines/[id]/run` if exposed publicly.

## Connectors

- [ ] Google callback URL registered; Drive uses `drive.file` scope.
- [ ] GitHub App callback registered; minimal permissions (contents/PR/issues/metadata).
- [ ] Disconnect / reconnect / not-configured states verified.

## Export safety

- [ ] ZIP and GitHub PR export both run the secret scanner.
- [ ] `.env.example` exports fine; a planted secret is blocked with a clean message.

## Billing

- [ ] Stripe live keys + price IDs set; checkout/portal work or show a clean setup state.
- [ ] Credits cannot be granted from the client; gates enforced server-side.

## UI / UX

- [ ] No dead/fake buttons (unfinished flows are clearly disabled with a reason).
- [ ] Loading / empty / error states present on major actions.
- [ ] No raw stack traces shown to users; no uncaught console errors on the demo path.

## Performance

- [ ] Large graph (50+ nodes) + large dataset (500 rows) remain usable.
- [ ] Tables/JSON views are capped/paginated; autosave is debounced.

## Build

- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] New code is lint-clean (document any pre-existing baseline).
