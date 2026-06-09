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

Supabase is already wired to the hosted **Flowmind** project. The one thing you must add
for generation + runs:

| Var | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **yes** — for generation + runs | Get one at [console.anthropic.com](https://console.anthropic.com). Server-side only; the browser never sees it. |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-4-6`. |
| `NEXT_PUBLIC_SUPABASE_URL` | pre-filled | Hosted Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pre-filled | Anon key (permissive RLS, single-user V1). |

Without `ANTHROPIC_API_KEY`, generation falls back to the closest built-in template and
**Run** returns a clear "add your key" message — the seed templates and their example runs
still demonstrate the full UI.

## How it works

- **Schema-first.** Everything validates through Zod (`lib/pipeline/schema.ts`): `Pipeline`,
  `PipelineNode`, `PipelineEdge`, `OutputTable`, `UIBinding`, `RunTrace`.
- **Generate** (`app/api/generate-pipeline`) — Claude structured generation → validated +
  auto-laid-out pipeline; repairs once, falls back to a template if needed.
- **Run** (`app/api/run`) — topologically executes each node with real Claude
  (`lib/pipeline/executeNode.ts`), **streaming** node-by-node so statuses animate and output
  tables fill live.
- **Output tables** are first-class. **UI bindings** map tables to preview components
  (metric cards / record list / summary). The right panel shows Final Output, Key Highlights,
  the tables (TanStack), and a live UI preview.
- **Autosave** writes the graph to Supabase (`pipelines`); runs persist to `runs`.
- **Export** downloads a zip: `pipeline.json`, `agents/*.json`, `mock-data.json`,
  `run-pipeline.ts`, `README.md`, `spec.md`.

## Supabase

Schema lives in `supabase/migrations/0001_init.sql` (`pipelines` + `runs`). **RLS is
permissive** for the single-user V1 prototype — tighten the policies before exposing it
publicly (this is the first follow-up when auth is added).

## Deploy (Vercel)

Set the same env vars in your Vercel project (`ANTHROPIC_API_KEY` plus the two
`NEXT_PUBLIC_SUPABASE_*` values) and deploy. Without them the deployed app still renders the
seed pipeline beautifully; with them, generation, runs, and cloud autosave all work.

## Forward-compat: teams of agents

Every `PipelineNode` carries an optional `team` (strategy + `agents[]`). V1 runs a single
agent per node; `executeNode` branches on `team` so a node can become a crew
(sequential / parallel / router / debate / vote) with no schema change.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — eslint
