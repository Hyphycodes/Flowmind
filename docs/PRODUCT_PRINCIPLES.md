# Flowmind — Product Principles

Flowmind is an **AI System Design Studio** and **AI Product Synthesizer**. Not a workflow
platform, not a Dify clone, not a dashboard.

> Build the brain, see the teams, inspect the handoffs, shape the data, preview the product,
> and ship the blueprint.

## The loop (never break this)

Describe → Product Drop → Team Nodes on the canvas → Crew Rooms → Input Studio source data →
execution + Handoff Packets → Output Tables → UI Preview → Takes → Export blueprint.

## Protect these

- **The dark, open canvas is the hero.** Fluid @xyflow nodes, thin curved edges, soft status
  glows, slim glassy sidebar, bottom command bar, right product/output panel. Don't make it
  bright, dashboard-heavy, or generic.
- **High-level on the canvas; depth via drilldown.** Team Nodes show departments — not every
  agent. Crew Room, Packet View, Trace, and the right-panel tabs hold the detail.
- **Input Studio is not mock data.** It generates deliberate, reusable, scored seed datasets.
- **Output tables are first-class.** UI bindings connect tables to preview components; every
  surface shows a "powered by `<table>`" label.
- **Schema-first.** Everything validates through `lib/pipeline/schema.ts`. All upgrades are
  additive + optional so existing pipelines stay valid.
- **Export must be useful outside Flowmind.** A real, multi-mode blueprint — never just JSON.
- **Never export secret values.** `.env.example` lists keys only.

## Don'ts

- Don't rebuild the app or change its visual soul.
- Don't add noisy admin pages, fake billing, fake marketplaces, or broken buttons.
- Don't show all internal agents on the main canvas.
- Don't use lorem ipsum — demo data must convince a real person.
- Don't duplicate schema systems; extend the canonical ones.
