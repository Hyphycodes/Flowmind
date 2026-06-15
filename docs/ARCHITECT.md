# Flowmind — The Architect (Prompt 01)

The **Architect** turns a plain-language description into a complete pipeline — nodes, teams,
and wiring — that lands on the canvas ready to run. It is the first beat of the primary loop:

> **Describe → Generate → Render Canvas** → Run → Fill Output Tables → Update UI Preview → Autosave → Export

It runs in the bottom **command bar** ("Describe the AI system you want to build…"). You type a
system in one sentence; the Architect designs the graph; the canvas renders it. Most sessions
start here.

## What it produces

One JSON object describing a pipeline — a directed graph where data flows from **one Input node**,
through agent / tool / transformer / evaluator nodes (and **team** nodes), to **one Output node**.
Every node declares `inputs`/`outputs` (snake_case table keys); a node may only read outputs
produced upstream. The result is validated and laid out before it touches the canvas, so the graph
is always a legal Flowmind `Pipeline`.

## Node kinds

`NODE_TYPES` in `lib/pipeline/schema.ts`:

| Kind | Job |
| --- | --- |
| `input` | Exactly one, first. The seed/source the pipeline reads. |
| `agent` | One focused LLM step — a single role with a specific prompt. |
| `tool` | A deterministic call — search / db / fetch / compute. Used for facts and exact math. |
| `transformer` | Reshape / merge. No LLM. |
| `evaluator` | Score / rank / check / gate. |
| `output` | Exactly one, last. Defines the small set of fields the UI shows. |

A **team** is not a separate node type — it is an `agent` node carrying a `team` object
(`teamSchema`): `{ strategy, agents[], lead, internalEdges }`. On the canvas it reads as a
department; selecting it opens the Crew Room (`components/panels/NodeInspector.tsx`). Use a team
only when **3–4 nodes form one coordinating sub-job** — never wrap a single node, never nest more
than 3 deep.

### Team strategies

The schema's `TEAM_STRATEGIES` are `single` / `sequential` / `parallel` / `debate` / `vote` /
`router` / `council`. The Architect designs with this subset:

- **sequential** — agents run in order, each building on the last.
- **parallel** — agents work the same input independently; results are merged.
- **router** — a lead picks which agent handles the input.
- **debate** — agents argue toward a stronger answer.
- **vote** — agents answer independently; the majority/lead decides.

## The effort dial

`EFFORT_LEVELS = ["tight", "balanced", "deep"]` lives in the dependency-free `lib/pipeline/effort.ts`
(so client components can import the levels + labels without pulling in the AI SDK; `architect.ts`
re-exports the `EffortLevel` type). The command bar
exposes a glassy **Tight / Balanced / Deep** selector; the choice lives in the store
(`effort` + `setEffort`, default `"balanced"`). Effort sizes the design — never the quality of any
single node.

| Effort | Shape | Nodes | Teams |
| --- | --- | --- | --- |
| **tight** | One clean chain. Favor a single strong agent. | ~3–6 | 0–1 |
| **balanced** (default) | A few focused nodes + small teams. | ~6–12 | 1–2 |
| **deep** | A rich org — large parallel/vote/debate teams, routers, nested teams. Up to ~50 agents total across all teams. | richer | several |

Rule across all three: **never add a node that doesn't change the result.**

## How it's wired (engine → route → store → command bar)

```
CommandBar.tsx ──generate(description, effort)──▶ pipelineStore.ts
      │                                                  │
      │                                          POST /api/generate-pipeline
      │                                                  │
      ▼                                                  ▼
 effort selector                           app/api/generate-pipeline/route.ts
 (Tight/Balanced/Deep)                                   │
                                          ┌──────────────┴───────────────┐
                                          ▼                              ▼
                              generateArchitectPipeline()         matchTemplate()  (fallback)
                              lib/pipeline/architect.ts           lib/pipeline/fixtures.ts
                                          │
                              real Claude via generateObject (AI SDK)
                                          │
                                  repairPipeline()  ──▶  validated + laid-out Pipeline
                                  lib/pipeline/validate.ts
```

- **Effort module** — `lib/pipeline/effort.ts` (dependency-free): `EFFORT_LEVELS`, `EffortLevel`,
  `isEffort`, plus `EFFORT_LABELS`/`EFFORT_HINTS` for the UI. Imported by the command bar + store.
- **Engine** — `lib/pipeline/architect.ts` exports `generateArchitectPipeline(description, effort)`
  (and re-exports the `EffortLevel` type). It calls real Claude server-side via the
  Vercel AI SDK (`generateObject`), then maps the model's JSON into Flowmind's canonical schema and
  validates/lays it out with `repairPipeline`. It is given the available node kinds and the tool
  catalog (`lib/tools/registry.ts`) so it can wire real tool nodes rather than inventing them.
- **Route** — `app/api/generate-pipeline/route.ts` (`runtime = "nodejs"`). POST body
  `{ description: string, effort?: "tight" | "balanced" | "deep" }`. Returns
  `{ pipeline, source: "ai" | "template", note? }`.
- **Store** — `store/pipelineStore.ts`: `generate(description, effort?)` POSTs to the route, parses
  the returned pipeline through `pipelineSchema`, sets it active, and autosaves. `effort` /
  `setEffort` live in the store (default `"balanced"`).
- **Command bar** — `components/command/CommandBar.tsx`: the description input + the effort
  selector. This is the primary text interaction; don't replace it with a modal/dashboard.

The browser never sees `ANTHROPIC_API_KEY` — generation is server-side only.

## Fallback behavior

The Architect always returns a usable pipeline.

- **No API key** — when `ANTHROPIC_API_KEY` is missing, the route skips the model, calls
  `matchTemplate(description)` (keyword-scored against the built-in templates; Market Research is
  the generic default), instantiates an editable copy, and returns `source: "template"` with a
  `note` telling the user to set the key for custom generation.
- **Generation error** — if the model call or mapping throws, the route catches it and falls back
  to the closest template the same way, with a `note`. Error strings pass through `safeApiError`
  so nothing sensitive leaks.

Deterministic-first: the demo builder stays alive with zero keys. The model is an enhancement,
never a hard dependency.

## Design rules the model follows

1. **One job per node.** Find the real steps; don't bundle two jobs into one node.
2. **Tools for facts and exact math** — anything that must be correct, not plausible.
3. **Teams only for real sub-jobs** — 3–4 coordinating nodes. Don't wrap a single node; don't nest
   beyond 3 deep.
4. **Wire by data.** Outputs are snake_case and referenced exactly downstream. Every edge connects
   existing ids; every non-input node is reachable from input; every non-output node reaches
   output; every declared input appears in some upstream node's outputs (or the input's fields).
5. **One input, one output.** The output defines the small set of fields the user actually sees.
6. **Naming.** Node titles are short, human, role-like. Each agent prompt is written in the second
   person, specific about its one job, naming the inputs it uses and the output it produces.
7. **Invent nothing about the user.** Stay generic to the stated domain; if the request is vague,
   still return a best-guess pipeline rather than failing.

## Testing it

A good smoke test for the Architect: it should cleanly **regenerate the built-in templates** from a
one-line description — same rough shape, valid graph, sensible output fields. Try each
(`lib/pipeline/fixtures.ts`):

- **Real Estate Deal Analyzer** — "Analyze a property address into comps, ARV, repair estimate, a deal score, and a max offer."
- **Content Repurposer** — "Turn one long post into hooks, short-form scripts, and platform captions."
- **Inbox Assistant** — "Triage my inbox, prioritize messages, and draft replies for approval."
- **Market Research Engine** — "Research a market: gather sources, score credibility, extract findings, write a thesis."
- **Sales Lead Qualifier** — "Score and tier inbound leads, enrich them, and draft personalized outreach for approval."

Check that: there is exactly one `input` and one `output`; every edge connects existing ids; the
graph is fully connected input→output; ids are unique snake_case; any team carries a `strategy` and
members; and node counts track the effort dial (tight ≈ 3–6, balanced ≈ 6–12, deep richer). With no
`ANTHROPIC_API_KEY`, the route returns `source: "template"` — that path is the fallback contract,
not the Architect itself.

See also: `docs/ARCHITECTURE.md` (system map), `docs/TEMPLATE_PACKS.md` (the seed templates),
`docs/EXPORT_FORMAT.md` (where the pipeline goes next).
