# Flowmind — Agent Guide

Flowmind is a **visual AI agent pipeline builder**. Describe an AI system in plain
language → see it as a node graph on an open canvas → run it with **real Claude** →
watch structured data fill output tables → preview a UI powered by those tables →
autosave → export runnable files.

## Product principle

The app is **not a dashboard**. It is an open canvas for composing intelligence.
The main reaction should be: "Damn, I can see the brain."

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

## Forward-compat: teams of agents

A `PipelineNode` already carries an optional `team` (strategy + agents[]). V1 renders and
executes a single agent per node; `lib/pipeline/executeNode.ts` branches on `team` so
multi-agent nodes are a non-breaking later addition. Do not remove the `team` field.

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
- `ANTHROPIC_API_KEY` — **required** for generation + runs. Without it those return a
  clear "missing key" response; seed templates + their example runs still demonstrate the UI.
- `ANTHROPIC_MODEL` — optional, default `claude-sonnet-4-6`.

## Security note

RLS is currently permissive (single-user prototype, no auth). Tighten policies in
`supabase/migrations` when auth is added — this is the first follow-up.
