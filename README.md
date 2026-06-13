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

Schema lives in `supabase/migrations/` — `0001` (`pipelines` + `runs`), `0002` (`datasets`,
`takes`, `pipeline_versions`, `tools`, `model_configs`), `0003` (Input Studio dataset
metadata), `0004` (model/tool registry), `0005` (Take eval scores), `0006` (`exports`
history). The app runs fully without the later migrations — they only add persistence for
optional metadata. **RLS is permissive** for the single-user V1 prototype — tighten the
policies before exposing it publicly (the first follow-up when auth is added).

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

Flagship fixture: **Jarvis Places Radar** — Source → Taste → Ranking → Planning → Composer
teams with real handoff packets, three sample Takes, and a recommendation-card UI surface.
This is why Flowmind exists.

## Template packs

Templates are grouped into preset **packs** (`lib/pipeline/packs.ts`): Jarvis, Real Estate,
Content Studio, Inbox Operator, Research Analyst, Sales Agent, and AI Stylist. The Templates
page groups cards by pack with node/team/agent/table counts and a readiness score.

## Docs

- [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md) — what to protect and why.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — subsystem map and where things live.
- [`docs/EXPORT_FORMAT.md`](docs/EXPORT_FORMAT.md) — export modes + ZIP layout.
- [`docs/TEMPLATE_PACKS.md`](docs/TEMPLATE_PACKS.md) — the packs and their templates.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
