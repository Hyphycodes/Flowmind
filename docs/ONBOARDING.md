# Flowmind — Onboarding

`app/onboarding/page.tsx`. Reached after sign-in (auth callback → `/onboarding`) or directly.
Kept short — three steps, no tooltip spam.

1. **Welcome** — one sentence + the three things Flowmind creates (agent teams, generated
   data, preview/export).
2. **Pick a use case** — cards mapped to templates: AI Agent System / Research Crew →
   Research Crew, Meal Curator, Content Studio, Inbox Operator, Research Engine, Sales Agent,
   Custom (blank).
3. **Choose a start** — Use demo / Input Studio data (recommended, no keys), Connect Google
   Drive (optional, clearly separate from sign-in), or Start blank.

On finish it POSTs `/api/onboarding/complete` (sets `profiles.onboarding_completed` when
signed in; no-op in demo), stores local onboarding state, and opens the chosen template
(`/?template=<id>` or `/?new=1`).

The builder's own first-run canvas ("What are we building?") covers the unauthenticated path.
