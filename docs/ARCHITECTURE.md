# Flowmind — Architecture

Mental model: **Source → Brain → Surface**. Next.js 16 App Router, React 19, TypeScript,
Tailwind v4, @xyflow/react, Zod, Zustand. Schema-first: everything flows through
`lib/pipeline/schema.ts`.

## Where things live

| Area | Path | Notes |
| --- | --- | --- |
| Canonical schemas | `lib/pipeline/schema.ts` | Pipeline, nodes, edges, teams, packets, tables, takes, product drop, reality meter, remix, etc. |
| Generation | `app/api/generate-pipeline` + `lib/pipeline/generatePipeline.ts` | Claude structured gen → validated/laid-out pipeline. |
| Execution engine | `app/api/run` + `lib/pipeline/executeNode.ts` | Streaming topo run; team strategies; emits packets + traces. Keys off `modelAvailable` (simulate forces it false). |
| Portable runtime (SDK) | `lib/runtime/*` | Dependency-free deterministic runner. Used by the hosted run endpoint; mirrored into exports. |
| Hosted run API | `app/api/pipelines/[pipelineId]/run` | Loads a pipeline (by id or body) and runs the portable runtime. No secrets; no auth (prototype). |
| Source layer | `lib/datasets/*`, `app/api/input-studio`, `lib/contracts/*` | Input Studio datasets, source modes, quality, contracts, field mappings, scenarios. |
| Models / tools | `lib/models/*`, `lib/tools/*` | Provider-agnostic registry, router, recommendations, status, tool defs + adapters. |
| Packets | `lib/packets/*` | Handoff packets, field-drift detection, timeline. |
| Execution / Takes / Evals | `lib/takes/build.ts`, `lib/evals/*` | Take build + comparison + cost summary; deterministic eval runner. |
| Product layer | `lib/product/*` | Product Drop, Reality Meter, Brief, Explain, Remix (propose-then-apply). |
| Export | `lib/export/*` (+ thin `lib/pipeline/exporter.ts`) | Multi-mode ZIP, health check, manifest, docs, runtime templates. |
| Template packs | `lib/pipeline/fixtures.ts`, `lib/pipeline/teamFixtures.ts`, `lib/pipeline/packs.ts` | Seed templates grouped into 7 packs. |
| State | `store/pipelineStore.ts` | Single Zustand store: pipeline, run, datasets, takes, product, export. |
| Persistence | `lib/supabase/*`, `supabase/migrations/0001`–`0006` | Autosave + best-effort history. Later migrations additive/optional. |
| Canvas | `components/canvas/*` | AgentNode, DataEdge, PipelineCanvas. |
| Panels | `components/panels/*` | Product, Preview, Input, Data, Output, Packets, Takes tabs + NodeInspector + SourceLayer + InputStudioPanel. |
| Product / export UI | `components/product/*`, `components/export/*` | RemixProposalModal, ExportDialog. |

## Data flow

`Pipeline` (graph jsonb) → `/api/run` streams `RunEvent`s → store assembles `RunTrace` →
`runEvals` + `buildTake` → store `takes` → `refreshProduct` recomputes Product Drop / Reality
Meter / Brief → `createExportBundle` packages everything for export.

## Conventions

- Additive, optional schema fields only. Persist new pipeline-scoped objects in the `graph`
  jsonb via `graphOf` (no new tables unless genuinely needed).
- Deterministic-first: evals, reality meter, remix, and the portable runtime all work with no
  model key. The model is an enhancement, never a hard dependency.
