# Flowmind — Agent Guide

Flowmind is a **visual AI agent pipeline builder**. Describe an AI system in plain
language → see it as a node graph on an open canvas → run it with **real Claude** →
watch structured data fill output tables → preview a UI powered by those tables →
autosave → export runnable files.

## Product principle

The app is **not a dashboard**. It is an open canvas for composing intelligence.
The main reaction should be: "Damn, I can see the brain."

**Preserve the existing UI — do not rebuild from scratch.** The dark open canvas, fluid
@xyflow nodes, slim sidebar, bottom command bar, and right output panel ARE the product.
Refactor and extend; never replace them with a generic dashboard / shadcn admin shell /
Dify clone. The canvas is the hero. Most upgrades are schema + lib + fixtures, not redesign.

Positioning: Flowmind is an **AI System Design Studio** — design, simulate, inspect, remix,
and export complex AI systems (teams of agents, sources, outputs, UI surfaces) without the
UI becoming chaotic.

## Primary loop (never break this)

> Describe → Generate / Open Pipeline → Render Canvas → Run → Fill Output Tables →
> Update UI Preview → Autosave → Export

Never add features that distract from this loop unless explicitly requested. If
something has to give, cut from secondary surfaces (Library / Runs / Settings), never
from the loop.

## Design constraints

- Open dark creative workspace; minimal chrome; floating controls.
- Slim glassy left sidebar (matches the product reference) — not a bulky dashboard rail.
- Fun colored nodes, thin curved edges, soft status glows.
- Bottom command bar is the primary text interaction.
- Right panel = outputs, tables, UI preview, trace. Collapsible.
- No generic admin-dashboard patterns, no lorem ipsum.

## Architecture constraints

- **Schema-first.** All pipelines validate through Zod (`lib/pipeline/schema.ts`).
- Canvas rendering consumes pipeline JSON only.
- Generation + execution use **real Claude** via the Vercel AI SDK, server-side only
  (`app/api/generate-pipeline`, `app/api/run`). The browser never sees `ANTHROPIC_API_KEY`.
- The run engine produces a structured `RunTrace` + `OutputTable[]`.
- Output tables are first-class objects; UI bindings connect tables to preview components.
- Persistence is Supabase (`lib/supabase/*`); autosave writes the pipeline graph.
- Keep subsystems isolated.

## Architecture map (Source → Brain → Surface)

Mental model used in schemas + labels: **Source** (where data comes from) → **Brain**
(what intelligence does) → **Surface** (how it becomes usable). All upgrade fields are
additive + optional so existing pipelines stay valid.

- **Team Nodes / Crew Rooms.** A `PipelineNode.team` (`lib/pipeline/schema.ts`) holds a
  `strategy` (single/sequential/parallel/debate/vote/router/council) + `agents[]` + a
  `lead`. The canvas shows departments; selecting a team node opens the **Crew Room**
  (`components/panels/NodeInspector.tsx`) — agents, lead, models, mute. `executeNode`
  branches on `team`. Do not remove the `team` field. Don't show all sub-agents on the
  main canvas by default.
- **Handoff Packets.** Slim compressed output passed between teams
  (`lib/packets/*`, `handoffPacketSchema`): summary, key fields, confidence, assumptions,
  missing data, warnings, field changes (added/compressed/dropped). `packetUtils` detects
  packet loss. Stored on `RunTrace.packets` + the Jarvis fixture.
- **Input Studio / Datasets.** Deliberate, reusable seed datasets (NOT random mock):
  `lib/datasets/*`, `app/api/input-studio`. `node.source` declares the `InputSourceMode`.
- **Data Contracts.** `edge.contract` declares expected/produced fields for validation.
- **Model providers.** `lib/models/*` — provider-agnostic registry, deterministic router,
  model selections, provider status, and Flowmind AI wrappers. Don't hardcode only Claude
  (Claude is the wired provider today; other providers are status/registry-ready).
- **Tool/API registry.** `lib/tools/*` — declarative tool defs, status checks, attachments,
  execution wrapper, and Input Studio/dataset fallbacks.
- **Execution / Takes / Evals (Prompt 05).** Runs have an `ExecutionMode`
  (`simulate`/`live`/`hybrid`); `simulate` forces deterministic/dataset-backed output. Every
  full run becomes a `Take` (additive fields on `takeSchema`). `lib/evals/runEval.ts` scores
  runs deterministically; `lib/takes/build.ts` builds Takes + comparisons + cost summaries.
  Takes UI = the right-panel "Takes" tab.
- **Product layer (Prompt 06).** `lib/product/*` — deterministic `generateProductDrop`,
  `calculateRealityMeter`, `generateProductBrief`, `explainProductBlueprint`, and the
  `remix` system (propose-then-apply; never mutate the pipeline blindly). Product objects
  persist inside the pipeline `graph` jsonb (like `blueprint`/`realityMeter`). UI = "Product"
  tab + `RemixProposalModal`. Preview renderers incl. scoreCard/recommendationCards/actionChips
  with "powered by <table>" labels.
- **Export / Runtime (Prompt 07).** `lib/export/*` (`createExportBundle`) builds a multi-mode
  ZIP (developer / client_blueprint / founder_brief / runtime / api) in a documented folder
  layout with a health check + `export-manifest.json`; `lib/pipeline/exporter.ts` is now a thin
  wrapper. `lib/runtime/*` is the portable, dependency-free SDK; `POST /api/pipelines/[id]/run`
  runs a saved pipeline. **Never export secret values.**
- **Template packs (Prompt 08).** `lib/pipeline/packs.ts` groups templates into 7 packs;
  the Templates page renders pack-grouped rich cards. Demo data must stay realistic — no lorem.
- **Accounts / connectors (Prompt 09).** Auth is config-gated — OFF by default so the public
  demo builder is preserved (`authEnabled()` needs `NEXT_PUBLIC_AUTH_ENABLED=true`). **Google
  sign-in ≠ Google Drive access** — keep them separate. Prefer narrow scopes (`drive.file`).
  OAuth tokens are AES-256-GCM encrypted server-side (`lib/auth/tokens.ts`) and **never** sent
  to the client, stored in pipeline JSON, or exported. SSR auth via `lib/supabase/browser.ts`
  + `serverClient.ts`; the legacy anon `client.ts` stays for the demo data path. RLS migration
  `0007` is transitional — apply only after enabling auth; don't hand-hack the DB.
- **Persistence.** `supabase/migrations/` runs `0001`–`0006`. Later migrations are additive +
  optional (saveDataset/saveTake/saveExport degrade gracefully without them). Use migrations,
  never hand-hack the DB.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 (CSS-first, no config
file — theme lives in `app/globals.css` `@theme`) · @xyflow/react · Zod · Zustand ·
@tanstack/react-table · Framer Motion · JSZip · AI SDK v6 (`ai` + `@ai-sdk/anthropic`) ·
@supabase/supabase-js.

## Next.js 16 notes

This is Next 16 — APIs differ from older Next. Bundled docs live in
`node_modules/next/dist/docs/`. Practical rules followed here: API routes are plain
`Request`→`Response` handlers; AI routes set `export const runtime = "nodejs"` and
`export const maxDuration = …`; dynamic `params`/`searchParams` are async (await them);
client components carry `"use client"`.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — eslint

## Env (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — wired (Supabase project "Flowmind").
- `ANTHROPIC_API_KEY` — required for live Claude generation + model-backed runs. Without it,
  generation falls back to templates and runs can use deterministic seeded output fallbacks.
- `ANTHROPIC_MODEL` — optional, default `claude-sonnet-4-6`.
- Optional provider/tool keys: `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
  `VERCEL_AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`,
  `MISTRAL_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SERPAPI_API_KEY`, `RENTCAST_API_KEY`,
  `ATTOM_API_KEY`.

## Security note

RLS is currently permissive (single-user prototype, no auth). Tighten policies in
`supabase/migrations` when auth is added — this is the first follow-up.
