# Remix — audit & decision aid

Read-only investigation (no code changed). Purpose: decide whether to **sharpen** remix or **cut**
it before launch.

## 1. What it does

Remix applies a **named, preset transformation** to the current pipeline and shows it as a
reviewable proposal (before/after) you apply or reject. The catalog (`lib/product/remix.ts`,
`REMIX_ACTIONS`) has **17 moves** across categories:

- **Structural (teams/speed):** Decompose, Add critic, Parallelize, Add checkpoint, Add evaluator,
  Add human approval.
- **Cost/quality:** Route models, Make it smarter, Make it cheaper, Make it faster, Make it premium.
- **Data:** Add source, Add Input Studio source.
- **UI/business:** Add UI, Make client-ready, Turn into SaaS.

## 2. Where/how it's triggered

Two entry points, and they use **two different engines** — this is the core finding:

- **Product panel** (`components/panels/ProductPanel.tsx`) → `store.startRemix(id)` →
  `buildRemixProposal()` — a **deterministic, no-AI** transform (`applyAction` in `remix.ts`) → the
  `RemixProposalModal` (apply/reject).
- **Command bar** structural chips (`REMIX_MOVES` in `CommandBar.tsx`, shown on any existing
  pipeline) → `store.proposeEdit(instruction, { remixAction })` → **the AI edit-diff flow**
  (`/api/edit-pipeline`) → the diff panel.
- A couple also appear as context chips on a selected team ("Make this team smarter", "Add an
  evaluator").

## 3. What it changes

The whole pipeline graph: adds/removes nodes (a critic, an evaluator, an approval gate), wraps
members into a team (parallelize), swaps models (route/cheaper/faster/smarter), switches a source,
binds a UI surface, or reframes product metadata (client-ready, SaaS). The deterministic path
applies cleanly and records a **Product Variation**; nothing mutates until you accept.

## 4. How it differs from normal editing

It mostly **doesn't** — and that's the problem. After Prompts 19a/19b the chat box already does
free-form, surgical, reviewable edits ("add a critic after the writer", "make the scorer cheaper").
The **structural** remix moves (Add critic, Parallelize, Decompose, Add checkpoint, Add evaluator,
Add approval) now duplicate that — and the command-bar versions literally route through the *same*
`/api/edit-pipeline` diff flow. The only genuinely distinct moves are the **opinionated bundles** a
user wouldn't think to phrase: *Make it premium, Make it cheaper/faster/smarter, Make client-ready,
Turn into SaaS, Route models* — one click applies a coordinated multi-node change with product framing.

## 5. State of completeness

Working end-to-end, not stubbed. The deterministic path (`buildRemixProposal` → `RemixProposalModal`
→ `applyRemix`) builds a real proposal, previews it, applies atomically, and records a variation; the
AI path reuses the hardened edit-diff flow. No dead ends found. The redundancy with chat editing is a
**product-clarity** issue, not a bug.

## 6. The one-sentence test

> **Remix is a menu of one-click, opinionated upgrades** (cheaper / premium / faster / client-ready /
> turn-into-SaaS) **that apply a coordinated multi-node change you wouldn't bother to type.**

That sentence is crisp *only* if remix is narrowed to the opinionated bundles. As it stands today
(17 moves, half of which overlap chat editing), a crisp one-sentence purpose is **not** writable —
which is itself the signal.

## Recommendation — **SHARPEN, don't cut**

Remix has one defensible job: **opinionated, coordinated upgrades**, distinct from free-form editing.

1. **Keep** the bundles that earn their place: *Make it cheaper / faster / smarter / premium, Route
   models, Make client-ready, Turn into SaaS, Add UI, Add Input Studio source.* These do something a
   user wouldn't phrase as a single chat edit.
2. **Drop from the catalog** the structural moves now better served by the chat editor (19a/19b):
   *Add critic, Add evaluator, Parallelize, Decompose, Add checkpoint, Add approval.* If kept at all,
   surface them as *suggested chat prompts*, not a parallel mechanism — so there's one way to make a
   structural change, not two.
3. **Frame it** as "Upgrades" in the Product tab (one curated row), not as a 17-button grid that
   competes with the chat box.

What removing the structural moves would touch (if you go further than the catalog trim):
`REMIX_ACTIONS` (remove ids), the `REMIX_MOVES` row in `CommandBar.tsx`, and the corresponding
`applyAction` branches in `remix.ts`. The deterministic engine, modal, and store actions stay.

**Net:** sharpen to ~8 opinionated bundles in one labelled "Upgrades" surface; let chat own
structural edits. Don't cut — the opinionated path is genuinely useful and already complete.
