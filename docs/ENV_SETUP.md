# Environment Setup

Copy `.env.example` → `.env.local` and fill in what you need. `.env*` is gitignored (except
`.env.example`) — **never commit real secrets**. Run `npm run audit:secrets` before pushing.

Everything is **optional and gated**: with nothing set, Flowmind runs as a public demo with
deterministic fallbacks. Add keys to light up features.

## Tiers

### 1. Core (recommended)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # publishable — safe in the browser
SUPABASE_SERVICE_ROLE_KEY=         # SERVER ONLY (Stripe webhook). Never client-side.
NEXT_PUBLIC_APP_URL=http://localhost:3000
ANTHROPIC_API_KEY=                 # live generation + runs (else deterministic fallback)
```

### 2. Accounts + connectors (optional)

```
NEXT_PUBLIC_AUTH_ENABLED=true          # turns on accounts (needs Supabase Google provider)
FLOWMIND_TOKEN_ENCRYPTION_SECRET=      # long random string — required before any OAuth connect
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=          # Google sign-in + Drive (drive.file)
GITHUB_APP_ID= / GITHUB_APP_PRIVATE_KEY= / NEXT_PUBLIC_GITHUB_APP_SLUG=   # GitHub repo/PR export
```

### 3. Billing (optional)

```
NEXT_PUBLIC_BILLING_ENABLED=true   # enforce plan limits + credit gating (off = unlimited preview)
STRIPE_SECRET_KEY=                 # SERVER ONLY
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_PRO_MONTHLY= / _YEARLY= / STRIPE_PRICE_STUDIO_MONTHLY= / _YEARLY=
```

### 4. Optional tools / providers

See `.env.example` for the full list (SerpAPI, RentCast, ATTOM, Google Places, OpenAI, Google,
Groq, etc.). All are status-gated — missing keys show a clear "missing key" state, never crash.

## Callback / webhook URLs to register

| Service        | URL                                              |
| -------------- | ------------------------------------------------ |
| Supabase Auth  | `${APP_URL}/auth/callback` (redirect allow-list) |
| Google OAuth   | `${APP_URL}/api/google/callback`                 |
| GitHub App     | `${APP_URL}/api/github/callback`                 |
| Stripe webhook | `${APP_URL}/api/billing/webhook`                 |

## Deploy (Vercel)

Set the same env vars in the Vercel project (Production + Preview). Keep all `*_SECRET` /
`*_KEY` (except the `NEXT_PUBLIC_*` publishable ones) **unexposed**. Apply Supabase migrations
`0001`→`0009` in order. Then open `/settings/readiness` to confirm posture.
