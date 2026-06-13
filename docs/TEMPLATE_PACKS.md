# Flowmind — Template Packs

Templates are grouped into preset **packs** in `lib/pipeline/packs.ts`. Each template is a
full system (Product Drop, graph, Team Nodes, source modes, output tables, UI bindings,
example run, and — for Jarvis — sample Takes). The Templates page renders pack-grouped cards
with node/team/agent/table counts and a readiness score. Opening a template instantiates an
editable copy.

| Pack | Templates | Demonstrates |
| --- | --- | --- |
| **Jarvis** | Jarvis Places Radar, Meal Curator | Team Nodes, Crew Rooms, handoff packets, Input Studio dataset, output tables → UI, Takes comparison, taste/vibe/corny-risk evals |
| **Real Estate** | Real Estate Deal Analyzer | property input, comps + ARV + repair tables, deal score, max offer, buyer pitch, evaluator, client blueprint |
| **Content Studio** | Content Repurposer | hooks, scripts, captions tables, posting-plan preview |
| **Inbox Operator** | Inbox Assistant | classified messages, priority queue, draft replies, human approval gate, Gmail tool placeholder |
| **Research Analyst** | Market Research Engine | source table, credibility scores, findings, thesis report, packet timeline |
| **Sales Agent** | Sales Lead Qualifier | leads table + scoring/tiers, enrichment, personalized email drafts, CRM tool placeholder, approval gate |
| **AI Stylist** | AI Outfit Curator | outfit cards, color/vibe, shopping list, style brief, taste evals |

Source of truth:

- Base templates + Sales: `lib/pipeline/fixtures.ts`
- Team templates (Jarvis / Meal / Outfit) + Jarvis Takes: `lib/pipeline/teamFixtures.ts`
- Pack grouping + metadata: `lib/pipeline/packs.ts`

## Adding a template

1. Build the `Pipeline` (+ optional `exampleRun`, `takes`) in `fixtures.ts` or `teamFixtures.ts`.
2. Register it in `TEMPLATES`.
3. Add its id to a pack's `templateIds` in `packs.ts` (or create a new pack).

Keep demo data realistic — no lorem ipsum. The demo should convince a regular person.
