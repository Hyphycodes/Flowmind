# Flowmind — Team Coordinator (Prompt 03)

The **Team Coordinator** gives a team its **identity** and its **internal coordination logic**.
The Architect (Prompt 01) decides *that* a team exists; the Coordinator decides *how the team
holds together* — who runs, in what order, who decides, and what the team looks like from the
outside. It runs whenever a team is **created** or its **membership / strategy changes**.

Given a team node's member agents and chosen strategy, it produces two things:

1. the team's **external identity** — `title`, `role`, `inputs`, `outputs`;
2. the visible **controller node(s)** the strategy requires (router / judge / aggregator).

It **never rewrites a member's prompt.** Members are self-contained and portable — you can drag one
out of a team and use it on its own, unchanged.

The engine is `coordinateTeamNode(node)` in `lib/pipeline/teamCoordinator.ts`. It is
**deterministic** — no LLM call — so it stays instant and free even for large teams (see
[Determinism](#determinism)).

## What a team is

A **team is a node that contains other nodes.** From the outside it behaves like any other node:
it consumes **inputs** and produces **outputs**. From the inside it holds its members plus, for some
strategies, controller nodes.

| | What it is | Portable? | Deleted when team dissolves? |
| --- | --- | --- | --- |
| **Member** | A worker agent (the real job). Its prompt is never rewritten. | Yes — drag it out, use it alone. | No — members survive. |
| **Controller** | A visible node the strategy needs (router/judge/aggregator). Clickable, inspectable, editable. | No — it only exists for this team. | Yes — controllers are removed. |

A member may itself be a team. **Teams nest at most 3 levels deep.**

## Strategies → required controller

The Coordinator builds exactly the controller a strategy needs — no more.

| Strategy | Controllers | How members run | Team inputs | Team outputs |
| --- | --- | --- | --- | --- |
| `sequential` | none | In order; each reads the previous output. | First member's inputs. | Last member's outputs. |
| `parallel` | 1 × **aggregator** | All at once on the team's inputs. | Union of members' inputs. | Aggregator merges into the team's declared outputs. |
| `router` | 1 × **router** | Router runs first, picks **exactly one** member; only that member runs. | What the router + members read. | Unified output names every member path resolves to. |
| `debate` | 1 × **judge** | All argue distinct/opposing positions in parallel. | Union of members' inputs. | Judge weighs positions → one resolved output. |
| `vote` | 1 × **aggregator** | All answer independently in parallel. | Union of members' inputs. | Aggregator takes the majority, or synthesizes the best answer when there's no majority. |

`controllers` is **empty for `sequential`** and **exactly one** for `parallel` / `router` /
`debate` / `vote`. (`single` / `council` from `TEAM_STRATEGIES` reuse the same machinery —
`single` needs no controller; `council` aggregates like `parallel`.)

## Identity

The Coordinator derives the team's outward identity from its members and strategy:

- **`title`** — a short, human, role-like name for the team as a unit.
- **`role`** — one line on what the team does as a whole.
- **`inputs`** — the names the team needs from upstream, derived from what the members (and the
  router) read, each listed **once**.
- **`outputs`** — depends on strategy:
  - `sequential` → the **last member's** outputs.
  - `parallel` / `vote` / `debate` → the **controller's** outputs.
  - `router` → **unified** output names that *every* member path resolves to.

Team outputs must use **stable names downstream can rely on**, regardless of which member actually
runs. A router team that sometimes runs member A and sometimes member B still presents one fixed
set of output keys.

## Controller prompts

A controller is a normal node (`id`, `title`, `inputs`, `outputs`, `prompt`) flagged as the team's
controller. Its prompt is written in the **second person** and references the **real member titles /
ids and the exact I/O** — never generic boilerplate.

| Kind | Prompt does | Key rule |
| --- | --- | --- |
| **router** | Inspect the inputs, choose **exactly one** member by id, pass inputs through to it. | Picks one; doesn't run them all. |
| **judge** (`debate`) | Read every position, compare on the criteria that matter, produce one resolved answer. | **Decides** — does not concatenate. |
| **aggregator** (`parallel`) | Map each member's output into the team's declared outputs. | Merge into the contract, not a dump. |
| **aggregator** (`vote`) | Take the majority; if there's no majority, synthesize the strongest answer with a one-line reason. | Majority first, then reasoned synthesis. |

**Controller id namespacing.** Controller ids are namespaced to the team — `<team_id>__router`,
`<team_id>__judge`, `<team_id>__aggregator` — and must not collide with member ids.

## Internal edges — the `input` / `output` boundary

`internalEdges` wire the team's interior. Two reserved endpoints stand for the team's boundary:

- **`input`** — incoming data. An edge *from* `input` means "fed by what the team consumes."
- **`output`** — the outgoing result. An edge *to* `output` means "this produces the team's result."

Invariants the Coordinator guarantees:

- Every member is **reachable from `input`**.
- Every team output is produced by a node that **reaches `output`**.

```
sequential   input → A → B → C → output

parallel     input ─┬→ A ─┐
                    ├→ B ─┤→ aggregator → output
                    └→ C ─┘

router       input → router ─┬→ A ─┐
                             ├→ B ─┤→ output     (all paths exist; the engine runs
                             └→ C ─┘              only the selected member; all
                                                  resolve to the same output names)

debate/vote  input ─┬→ A ─┐
                    ├→ B ─┤→ judge / aggregator → output
                    └→ C ─┘
```

For **router**, all member paths are wired (`input → router → each member → output`) even though
only one runs at execution time — every path resolves to the same output names so the team's
contract is stable.

## How it maps to the schema

A team lives on a node as `PipelineNode.team` (`lib/pipeline/schema.ts`, `teamSchema`):

```ts
team: {
  strategy,        // TEAM_STRATEGIES: single | sequential | parallel | debate | vote | router | council
  agents[],        // members AND controllers (AgentConfig)
  lead,            // agent id of the lead / synthesizer / chair
  internalEdges[], // { source, target } — endpoints include "input" / "output"
}
```

Controllers are **not a separate array** — they live in `agents[]` alongside members, flagged with
additive/optional fields on `agentConfigSchema`:

- `isController: true` — marks the node as the team's controller.
- `controllerKind: "router" | "judge" | "aggregator"` — which kind.

**Members are the non-controller agents.** These fields are additive and optional, so pipelines
authored before Prompt 03 stay valid: a team with no controller flag is just a `sequential`-style
crew. Member agent prompts are never touched by the Coordinator.

## How it's wired (engine → Architect → store / Crew Room → execution)

```
lib/pipeline/teamCoordinator.ts        coordinateTeamNode(node)  — deterministic, no LLM
        ▲                                       │  derives identity, builds controllers,
        │                                       │  derives inputs/outputs, wires internalEdges
        │                                       ▼
generated teams                          a fully-coordinated team node
        │                                       ▲
        ▼                                       │
lib/pipeline/architect.ts ──runs each generated team node through──┘
   (Prompt 01 — generated teams get proper controllers + identity + wiring)

store/pipelineStore.ts                   components/panels/NodeInspector.tsx (Crew Room)
   setTeamStrategy / addTeamAgent  ◀────  strategy selector + members/controllers list
   removeTeamAgent / coordinateTeam       (controllers styled distinctly from members)
        │  re-run the coordinator whenever a team changes
        ▼
lib/pipeline/executeNode.ts              at run time, the controller is the team's "chair":
                                         worker members run first, then the controller
                                         (aggregator / judge) synthesizes the team output
```

- **Engine** — `lib/pipeline/teamCoordinator.ts`: `coordinateTeamNode(node)` (+ helpers). The single
  source of truth for team identity + coordination.
- **Architect** — `lib/pipeline/architect.ts` runs every generated team node through
  `coordinateTeamNode`, so AI-generated teams arrive with the right controllers, identity, and wiring
  rather than a bare member list.
- **Store** — `store/pipelineStore.ts`: `setTeamStrategy`, `addTeamAgent`, `removeTeamAgent`, and
  `coordinateTeam` re-run the Coordinator whenever a team's strategy or membership changes in the
  Crew Room, so identity + controllers + edges stay in sync.
- **Crew Room** — `components/panels/NodeInspector.tsx`: selecting a team node opens the Crew Room,
  which shows members and controllers (controllers styled distinctly) plus a strategy selector.
- **Execution** — `lib/pipeline/executeNode.ts`: the controller acts as the team's **chair**. Worker
  members run first; then the controller (aggregator / judge) synthesizes the team's output
  (`pickChair` resolves the chair from `team.lead` → `isLead` → last member).

## Determinism

`coordinateTeamNode` is a pure, deterministic function — **no model call**. Identity, controllers,
inputs/outputs, and internal edges are derived purely from the members + strategy. This keeps team
coordination **instant and free**, so a team can scale to 50+ agents without any LLM cost and a
strategy switch in the Crew Room re-coordinates immediately.

## V1 execution note

The schema and Coordinator describe the **full** model. V1 execution
(`lib/pipeline/executeNode.ts`) may run **simplified** versions of the harder strategies: `sequential`
runs members in order and `parallel` runs them concurrently as specified, but `router` / `vote` /
`debate` currently run their members in parallel and then synthesize via the chair (the "parallel safe
fallback") rather than fully routing or formally judging. The identity, controllers, and wiring the
Coordinator produces are correct and stable today; richer per-strategy execution lands later without
changing the team's external contract.

See also: `docs/ARCHITECT.md` (how teams get generated, Prompt 01), `docs/ARCHITECTURE.md`
(system map), `docs/TEMPLATE_PACKS.md` (Research Crew / Meal / Outfit teams in `lib/pipeline/teamFixtures.ts`).
