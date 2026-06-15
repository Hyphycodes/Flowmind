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

- **Architect (Prompt 01).** Turns a plain-language description into a complete pipeline
  (nodes, teams, wiring) from the bottom command bar. The engine is `lib/pipeline/architect.ts`
  (`generateArchitectPipeline(description, effort)`): an effort-sized system prompt + the tool
  catalog → real Claude `generateObject` → a spec→canonical mapping (`architectToCandidate`) →
  `repairPipeline`. The **effort dial** (`tight|balanced|deep`) is a parameter, not a separate
  prompt; levels/labels live in the dependency-free `lib/pipeline/effort.ts` so the client can
  import them (never import `architect.ts` — it pulls the AI SDK — into client code). The dial
  lives in `components/command/CommandBar.tsx`; `store.generate(description, effort?)` + `effort`
  state thread it through; `app/api/generate-pipeline` reads `effort` and falls back to a template
  when `ANTHROPIC_API_KEY` is missing or generation fails. Teams generate as `agent` nodes carrying
  a `team` (nested sub-teams flatten into the crew). Keep Preview rendering deterministic — bindings
  are derived from the output node's `display`, not asked of the model. Docs: `docs/ARCHITECT.md`.
- **Team Nodes / Crew Rooms.** A `PipelineNode.team` (`lib/pipeline/schema.ts`) holds a
  `strategy` (single/sequential/parallel/debate/vote/router/council) + `agents[]` + a
  `lead`. `agents[]` holds both portable **members** and the **controllers** the Team
  Coordinator builds (flagged `isController` + `controllerKind`). The canvas shows
  departments; selecting a team node opens the **Crew Room**
  (`components/panels/NodeInspector.tsx`) — members + controllers (styled distinctly), a
  strategy selector, add/remove member, models, mute, a scroll list + member/controller
  counts (a pipeline can hold **50+ agents** across its teams). `executeNode` branches on
  `team`: controllers don't run as workers — the controller is the synthesis chair. Do not
  remove the `team` field. Don't show all sub-agents on the main canvas by default.
- **Team Coordinator (Prompt 03).** `lib/pipeline/teamCoordinator.ts` —
  `coordinateTeamNode(node)`, a **deterministic** (no-LLM, scales to big crews) function that
  gives a team its identity (title/role) and internal coordination: it builds the visible
  controller node(s) a strategy needs (parallel/vote → Aggregator, debate → Judge, router →
  Router; sequential → none), derives the lead, and wires `team.internalEdges` with reserved
  `input`/`output` boundary endpoints. It never rewrites a member's prompt. Re-run it whenever
  membership/strategy changes — the Architect runs generated teams through it, and the store
  (`setTeamStrategy`/`addTeamAgent`/`removeTeamAgent`/`coordinateTeam`) re-runs it on Crew Room
  edits. The team's declared `inputs`/`outputs` stay the stable downstream contract.
  Docs: `docs/TEAM_COORDINATOR.md`.
- **Canvas interaction.** Single-click a node → a focused **popover** (`components/canvas/
  NodePopover.tsx`): regular nodes/agents show *What came in · Prompt (editable) · What went
  out* (key names before a run, real `steps`/`agentRunTraces` values after); team nodes show a
  folder summary + **Open team**. The big `NodeInspector` is now **advanced settings only**
  (models/tools/source/IO) and opens via the popover's "Edit details" (`inspectorOpen` state),
  NOT on single click. Double-click a team → zoom into its internal canvas: a `teamPath` view
  stack (max depth 3) resolved by `lib/pipeline/teamView.ts` (`resolveTeamView` + ephemeral
  `layoutAgents`), with a breadcrumb; Esc/crumb returns. Drag one node onto another →
  `mergeNodeIntoTeam` forms/grows a team (rewires edges, re-runs the Coordinator, **undoable**
  via `undo()` / ⌘Z); detection uses React Flow `getIntersectingNodes`. Members are never
  rewritten — this layer is structure + presentation only.
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
- **GitHub integration (Prompt 10).** Repo export / PR / issues. Three SEPARATE concepts —
  GitHub **login** ≠ **repo connection** ≠ **PR export**; don't blur them. Repo access uses a
  **GitHub App** (preferred over personal tokens), config-gated by `githubConfigured()`
  (`GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` + `NEXT_PUBLIC_GITHUB_APP_SLUG` + auth + encryption
  secret). Installation access tokens are minted **server-side on demand** from the App private
  key (`lib/github/app.ts`) and are **never** sent to the client, stored in pipeline JSON, or
  exported — only connection METADATA persists (`github_connections`). GitHub export **reuses the
  existing export bundle** via `collectExportFiles` (pure, no JSZip) → `POST /api/github/export`
  creates a branch, commits files (existing files are **versioned, never overwritten**), and
  optionally opens a PR with a generated body; an export **secret scan**
  (`lib/github/secretScan.ts`) blocks leaks before any write. Issues come from the Reality Meter +
  health check (`lib/github/issues.ts`). GitHub also works as a **source/tool** (modes
  `github_repo`/`github_file`/`github_issues`/`github_pull_requests`; registry tools). Library in
  `lib/github/*`; UI in `components/github/*` + the Export dialog's GitHub tabs. Don't design
  around copy-pasted personal access tokens. Docs: `docs/GITHUB_INTEGRATION.md`,
  `docs/GITHUB_EXPORT.md`, `docs/REPO_SOURCE_NODES.md`.
- **Billing / credits (Prompt 11).** Plans, credits, usage, feature gates, Stripe. OFF by default
  (`billingEnabled()` ← `NEXT_PUBLIC_BILLING_ENABLED`) so the public demo runs unlimited/free —
  when off, every gate returns `{allowed:true}` and nothing is charged. **Centralize ALL plan
  checks in `lib/billing/featureGates.ts`** — never scatter plan logic. Plans are config-driven
  (`lib/billing/plans.ts`, prices from env). Credits are deterministic + the user-facing
  abstraction (`lib/billing/credits.ts`) — **never invent exact provider dollar costs**. Usage +
  balance + logging are server-side + best-effort (`lib/billing/usage.ts`, degrade without the
  tables). Gating is applied in `app/api/run` (402 → store opens `UpgradeModal`), `app/api/
  input-studio`, and `app/api/github/export`; basic ZIP export stays available. Stripe via REST +
  webhook signature verification (`lib/billing/stripe.ts`) — **never expose `STRIPE_SECRET_KEY`**
  (webhook writes via `serviceClient.ts`). BYOK is schema/doc-represented (`user_model_keys`,
  encrypted refs only). UI: sidebar `UsageMeter`, `/settings/billing`, `/pricing`, `UpgradeModal`,
  `CreditEstimate` (TopBar + Export). Routes `app/api/billing/*`. Docs: `docs/BILLING.md`,
  `CREDITS_AND_USAGE.md`, `PLANS.md`, `STRIPE_SETUP.md`.
- **Persistence.** `supabase/migrations/` runs `0001`–`0009`. Later migrations are additive +
  optional (saveDataset/saveTake/saveExport + GitHub + billing records degrade gracefully without
  them). `0008` (GitHub) + `0009` (billing) apply after `0007` (auth). Use migrations, never
  hand-hack the DB.

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
- `npm run typecheck` — `tsc --noEmit`
- `npm run audit:secrets` — scan tracked files for committed secrets (CI-friendly)

## Env (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — wired (Supabase project "Flowmind").
- `ANTHROPIC_API_KEY` — required for live Claude generation + model-backed runs. Without it,
  generation falls back to templates and runs can use deterministic seeded output fallbacks.
- `ANTHROPIC_MODEL` — optional, default `claude-sonnet-4-6`.
- Optional provider/tool keys: `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
  `VERCEL_AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`,
  `MISTRAL_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SERPAPI_API_KEY`, `RENTCAST_API_KEY`,
  `ATTOM_API_KEY`.

## Security & hardening (Prompt 12) — rules for future agents

Production-shaped posture. When editing, keep ALL of these true:

- **Never expose secrets.** Provider/Stripe/service-role keys + OAuth/App tokens are server-only
  (`runtime = "nodejs"` routes). Never return them, log them, put them in pipeline JSON, or export
  them. Status routes return booleans + missing env NAMES only. Pass error strings through
  `safeApiError`/`redactSecrets` (`lib/security/secrets.ts`, `lib/api/guards.ts`).
- **Exports must pass the safety scanner.** Both ZIP (`createExportBundle`) and GitHub PR export
  call the shared scanner in `lib/security/secrets.ts`. Don't add an export path that skips it.
- **RLS: no permissive anon policies on private data.** Account/connector/billing tables (0007–
  0009) are strictly owner-scoped. The only transitional null-owned allowance is on pipelines/
  datasets/takes for the public demo — keep it isolated; don't widen it.
- **Server route guards.** Use `lib/api/guards.ts` (`requireUser`, `validateJsonBody`,
  `requirePipelineAccess`). Don't duplicate guard logic ad hoc.
- **Billing/credits are server-enforced.** Never trust client plan/credit state; gates live in
  `lib/billing/featureGates.ts`. Always verify the Stripe webhook signature.
- **Login ≠ resource access.** Google sign-in ≠ Drive; GitHub sign-in ≠ repo access. Keep separate.
- **Public demo stays isolated**, and **unfinished flows are clearly disabled** (no fake buttons).
- Don't rebuild/redesign the UI; this is a hardening posture, not a feature surface.

Docs: `docs/SECURITY.md`, `RLS_SECURITY.md`, `EXPORT_SECURITY.md`, `OAUTH_CONNECTORS.md`,
`ENV_SETUP.md`, `PRODUCTION_CHECKLIST.md`, `BETA_READINESS.md`. Readiness self-check:
`/settings/readiness`.
