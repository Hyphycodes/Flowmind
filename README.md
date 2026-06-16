# Flowmind

**A visual AI agent pipeline builder.** Describe an AI system in plain language → see it
as a node graph on an open canvas → run it with **real Claude** → watch structured data
fill output tables → preview a UI powered by those tables → autosave → export runnable files.

> The app is not a dashboard. It's an open canvas for composing intelligence —
> _"Damn, I can see the brain."_

## The loop

```
Describe → Generate / Open Pipeline → Render Canvas → Run → Fill Output Tables
        → Update UI Preview → Autosave → Export
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 (CSS-first) ·
[@xyflow/react](https://reactflow.dev) canvas · Zod (schema-first) · Zustand ·
@tanstack/react-table · Framer Motion · JSZip · AI SDK v6 (`ai` + `@ai-sdk/anthropic`) ·
Supabase.

## Quickstart

```bash
npm install
npm run dev          # http://localhost:3000
```

### Environment (`.env.local`)

Supabase is already wired to the hosted **Flowmind** project. Claude is the wired model
adapter today; other providers and tools can be configured and will show readiness in
Settings without exposing secret values.

| Var | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **yes** — for generation + runs | Get one at [console.anthropic.com](https://console.anthropic.com). Server-side only; the browser never sees it. |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-4-6`. |
| `FLOWMIND_DEFAULT_REASONING_MODEL` | no | Router default for judgment-heavy nodes. |
| `FLOWMIND_DEFAULT_FAST_MODEL` | no | Router default for classifiers/routers. |
| `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`, etc. | no | Provider status only until adapters are wired. |
| `GOOGLE_PLACES_API_KEY`, `SERPAPI_API_KEY`, `RENTCAST_API_KEY`, `ATTOM_API_KEY` | no | Starter tool readiness checks and future live handlers. |
| `NEXT_PUBLIC_SUPABASE_URL` | pre-filled | Hosted Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pre-filled | Anon key (permissive RLS, single-user V1). |

Without `ANTHROPIC_API_KEY`, generation falls back to the closest built-in template and
runs can use deterministic seeded outputs. Seed templates, Input Studio datasets, Crew
Room traces, and Packet View still demonstrate the full UI.

## How it works

- **Schema-first.** Everything validates through Zod (`lib/pipeline/schema.ts`): `Pipeline`,
  `PipelineNode`, `PipelineEdge`, `OutputTable`, `UIBinding`, `RunTrace`.
- **Generate** (`app/api/generate-pipeline`) — Claude structured generation → validated +
  auto-laid-out pipeline; repairs once, falls back to a template if needed.
- **Run** (`app/api/run`) — topologically executes each node with real Claude
  (`lib/pipeline/executeNode.ts`), **streaming** node-by-node so statuses animate and output
  tables fill live. If the selected model/provider is not ready, Flowmind records the
  fallback clearly and uses seeded output tables.
- **Output tables** are first-class. **UI bindings** map tables to preview components
  (metric cards / record list / summary). The right panel shows Final Output, Key Highlights,
  the tables (TanStack), and a live UI preview.
- **Run modes & Takes.** Runs execute in a mode — `simulate` (datasets / deterministic),
  `live` (real models + tools), or `hybrid`. Every full run becomes a **Take** (run trace +
  model selections + cost + latency + eval scores); compare 2–5 Takes on quality vs. cost vs.
  speed. Deterministic **evals** (`lib/evals`) score each run; cost/latency trace included.
- **Product layer.** A **Product Drop** (name, pitch, target user, Source/Brain/Surface) and a
  deterministic **Reality Meter** (buildability + missing APIs + fastest MVP) render in the
  Product tab. **Remix** actions (make it premium/cheaper/smarter, add evaluator, …) produce a
  reviewable proposal before anything is applied.
- **Autosave** writes the graph to Supabase (`pipelines`); runs persist to `runs`.
- **Export** (`lib/export`) builds a multi-mode ZIP — **Developer Package, Client Blueprint,
  Founder Brief, Runtime Package, Hosted API** — with a readiness **health check**, an
  `export-manifest.json`, README/SPEC/.env.example, and a portable runtime. No secret values.
- **Runtime / SDK.** `lib/runtime` is a portable, dependency-free pipeline runner (future
  `@flowmind/sdk`). `POST /api/pipelines/[id]/run` runs a saved pipeline over HTTP.

## Supabase

Schema lives in `supabase/migrations/` — `0001`–`0006` (pipelines, runs, datasets, takes,
registries, exports) plus `0007` (auth: profiles, workspaces, connected accounts, Google Drive
files, ownership + RLS). The app runs fully without the later migrations — they only add
persistence/ownership. **RLS is permissive** until `0007` is applied; apply it after enabling
auth (see below). Details: [`docs/RLS_SECURITY.md`](docs/RLS_SECURITY.md).

## Accounts, auth & Google Drive

Accounts are **opt-in and off by default** — Flowmind runs as a public demo (no login) so the
builder and templates work for everyone. To turn on accounts:

1. Enable the **Google provider** in Supabase Auth and create a Google Cloud OAuth client.
2. Set `NEXT_PUBLIC_AUTH_ENABLED=true`, `NEXT_PUBLIC_APP_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Apply migration `0007`.

**Sign in with Google** (account) and **Connect Google Drive** (per-file `drive.file` access)
are deliberately separate. OAuth tokens are AES-256-GCM encrypted server-side
(`FLOWMIND_TOKEN_ENCRYPTION_SECRET`), never sent to the client and never exported. Drive
appears as a Source Mode + tool registry entries. See
[`docs/AUTH.md`](docs/AUTH.md) and [`docs/GOOGLE_DRIVE_CONNECTOR.md`](docs/GOOGLE_DRIVE_CONNECTOR.md).

## GitHub: push to a repo & open a PR

Beyond the ZIP, Flowmind can **push a finished AI system into a real GitHub repo as a branch or
pull request** — _"I put the AI system into your repo and opened a PR."_ GitHub **login**, repo
**connection**, and PR **export** are three separate concepts. Repo access uses a **GitHub App**
(preferred over personal tokens): set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and
`NEXT_PUBLIC_GITHUB_APP_SLUG`, then apply migration `0008` (after `0007`).

Installation tokens are minted server-side on demand and are **never** sent to the client, stored
in pipeline JSON, or exported. GitHub export **reuses the same export bundle**, runs a secret scan,
creates a branch (existing files are versioned — never overwritten), commits the files, and
optionally opens a PR with a generated description; it can also draft **implementation issues** from
the Reality Meter. GitHub is also a Source/Tool (repo tree, read file, list issues/PRs). See
[`docs/GITHUB_INTEGRATION.md`](docs/GITHUB_INTEGRATION.md),
[`docs/GITHUB_EXPORT.md`](docs/GITHUB_EXPORT.md), and
[`docs/REPO_SOURCE_NODES.md`](docs/REPO_SOURCE_NODES.md).

## Billing, credits & plans

The business layer: **plans** (Free / Pro / Studio / Enterprise), a **credit system**, **usage
logging**, central **feature gates**, and **Stripe**. It's **off by default** — set
`NEXT_PUBLIC_BILLING_ENABLED=true` to enforce it; otherwise the public demo runs unlimited/free and
gates always allow. Credits are the user-facing unit (we never invent exact provider dollar costs).

Real AI runs, Input Studio generation, and GitHub PR export are gated; a blocked action opens a calm
**upgrade modal** that always offers a non-paywall path ("Download ZIP instead"). The sidebar shows a
live **usage meter**; `/settings/billing` and `/pricing` show plans + usage. Stripe runs through the
REST API with **webhook signature verification**; the secret key is server-only and never exposed.
Apply migration `0009` (after `0007`). See
[`docs/BILLING.md`](docs/BILLING.md), [`docs/CREDITS_AND_USAGE.md`](docs/CREDITS_AND_USAGE.md),
[`docs/PLANS.md`](docs/PLANS.md), and [`docs/STRIPE_SETUP.md`](docs/STRIPE_SETUP.md).

## Deploy (Vercel)

Set the same env vars in your Vercel project (`ANTHROPIC_API_KEY` plus the two
`NEXT_PUBLIC_SUPABASE_*` values) and deploy. Without them the deployed app still renders the
seed pipeline beautifully; with them, generation, runs, and cloud autosave all work.

## Architecture — an AI System Design Studio

Flowmind isn't just a workflow builder — it's for designing complex AI systems and keeping
them legible. The model is **Source → Brain → Surface**:

- **Source** — where data comes from: Input Studio datasets, live APIs, uploads, memory.
- **Brain** — what intelligence does: agents, and **Team Nodes** (a crew of agents with a
  strategy: single / sequential / parallel / debate / vote / router / council).
- **Surface** — how it becomes usable: output tables, UI bindings, exports.

Key concepts:

- **Team Nodes & Crew Rooms.** The canvas shows departments, not all 50 agents. Click a
  team node to open its Crew Room (agents, lead, models, mute).
- **Handoff Packets.** Each team passes a slim compressed packet downstream — summary,
  key fields, confidence, assumptions, warnings, and what was added/compressed/dropped —
  so you can debug what got handed off and spot packet loss.
- **Input Studio.** Generate deliberate, reusable seed datasets (not random mock data) to
  test downstream agents without hitting live APIs every time.
- **Model providers.** Provider-agnostic registry with per-node/agent model picking,
  deterministic recommendations, fallback chains, and provider status checks (Claude is
  wired; OpenAI, Google, Vercel AI Gateway, OpenRouter, Groq, Cerebras, Mistral, local,
  and custom endpoints are registry-ready).
- **Tool/API registry.** Starter tools include Google Places, SerpAPI, RentCast, ATTOM,
  Supabase Query, Custom HTTP, Dataset Lookup, and Previous Take Lookup. Tools show
  ready/missing-key status and can fall back to Input Studio datasets.
- **Data contracts, Takes, Reality Meter, Product Drop, judges** — all
  schema-supported (`lib/models`, `lib/tools`, `lib/datasets`, `lib/packets`, `lib/evals`).
- **Export** also bundles `schema.json`, `crews/*`, `models/*`, `tools/*`, `datasets/*`,
  `handoff-packets.json`, `ui-bindings.json`, `env.example`, a **Client Blueprint**, and a
  **Founder Brief**.

Flagship fixture: **Research Intelligence Crew** — Source → Analysis → Scoring → Synthesis →
Composer teams with real handoff packets, three sample Takes, and a recommendation-card UI
surface. This is why Flowmind exists.

## Template packs

Templates are grouped into preset **packs** (`lib/pipeline/packs.ts`): Research Crew,
Content Studio, Inbox Operator, Research Analyst, Sales Agent, and AI Stylist. The Templates
page groups cards by pack with node/team/agent/table counts and a readiness score.

## Docs

- [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md) — what to protect and why.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — subsystem map and where things live.
- [`docs/EXPORT_FORMAT.md`](docs/EXPORT_FORMAT.md) — export modes + ZIP layout.
- [`docs/TEMPLATE_PACKS.md`](docs/TEMPLATE_PACKS.md) — the packs and their templates.
- [`docs/AUTH.md`](docs/AUTH.md) · [`docs/GOOGLE_DRIVE_CONNECTOR.md`](docs/GOOGLE_DRIVE_CONNECTOR.md) · [`docs/ONBOARDING.md`](docs/ONBOARDING.md) · [`docs/RLS_SECURITY.md`](docs/RLS_SECURITY.md) — accounts, Drive, onboarding, security.
- [`docs/GITHUB_INTEGRATION.md`](docs/GITHUB_INTEGRATION.md) · [`docs/GITHUB_EXPORT.md`](docs/GITHUB_EXPORT.md) · [`docs/REPO_SOURCE_NODES.md`](docs/REPO_SOURCE_NODES.md) — GitHub App connection, repo/PR export, repo source nodes.
- [`docs/BILLING.md`](docs/BILLING.md) · [`docs/CREDITS_AND_USAGE.md`](docs/CREDITS_AND_USAGE.md) · [`docs/PLANS.md`](docs/PLANS.md) · [`docs/STRIPE_SETUP.md`](docs/STRIPE_SETUP.md) — billing, credits, plans, Stripe setup.
- [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/EXPORT_SECURITY.md`](docs/EXPORT_SECURITY.md) · [`docs/OAUTH_CONNECTORS.md`](docs/OAUTH_CONNECTORS.md) · [`docs/ENV_SETUP.md`](docs/ENV_SETUP.md) · [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md) · [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md) — security model, hardening, and pre-launch checklist.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
