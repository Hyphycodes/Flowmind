import type {
  FinalOutput,
  Pipeline,
  ProductBrief,
  ProductDrop,
  RealityMeter,
} from "@/lib/pipeline/schema";
import { getTool } from "@/lib/tools/registry";
import { envVarsForTool } from "@/lib/tools/schema";
import { recommendModelForNode } from "@/lib/models/recommend";

export type DocsContext = {
  pipeline: Pipeline;
  drop: ProductDrop;
  reality: RealityMeter;
  brief: ProductBrief;
  finalOutput?: FinalOutput | null;
};

const bullets = (items: string[], empty = "_None_") => (items.length ? items.map((i) => `- ${i}`).join("\n") : empty);

/** Environment variables relevant to this pipeline only — never with secret values. */
export function deriveEnvExample(pipeline: Pipeline): string {
  const keys = new Set<string>(["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]);
  const toolIds = new Set(
    pipeline.nodes.flatMap((n) => [n.source?.toolId, ...n.toolAttachments.map((a) => a.toolId)]).filter(Boolean) as string[],
  );
  for (const id of toolIds) {
    const tool = getTool(id);
    if (tool) for (const env of envVarsForTool(tool)) keys.add(env);
  }
  // Google Drive source/connector keys (tokens are NEVER exported).
  if (pipeline.nodes.some((n) => n.source?.mode === "google_drive")) {
    keys.add("GOOGLE_CLIENT_ID");
    keys.add("GOOGLE_CLIENT_SECRET");
    keys.add("FLOWMIND_TOKEN_ENCRYPTION_SECRET");
  }
  // Persistence is optional but commonly used.
  keys.add("NEXT_PUBLIC_SUPABASE_URL");
  keys.add("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return (
    "# Environment variables for this Flowmind export. No secret values are included.\n" +
    [...keys].map((k) => `${k}=`).join("\n") +
    "\n"
  );
}

export function readmeMd(ctx: DocsContext): string {
  const p = ctx.pipeline;
  return [
    `# ${ctx.drop.name} — Flowmind Export`,
    ``,
    ctx.drop.pitch || p.description || "An exported Flowmind AI system.",
    ``,
    `This package contains the agent graph, crew definitions, source configs, output tables,`,
    `UI bindings, run traces, and a runnable TypeScript example for the **${ctx.drop.name}** pipeline.`,
    ``,
    `## How it works`,
    ``,
    `Source → Brain → Surface. ${ctx.drop.workflowSummary || p.description}`,
    ``,
    `## Run the example`,
    ``,
    "```bash",
    `npm install`,
    `npm start            # runs runtime/run-pipeline.ts in simulate mode`,
    "```",
    ``,
    `## Environment`,
    ``,
    `Copy \`.env.example\` to \`.env\` and fill in keys. Simulate mode needs no keys; live/hybrid`,
    `execution needs \`ANTHROPIC_API_KEY\` (and any tool API keys listed).`,
    ``,
    `## How models are selected`,
    ``,
    `Each node carries a model selection (auto / manual / fallback chain). See \`models/\`.`,
    ``,
    `## How tools are attached`,
    ``,
    `Tool attachments declare which APIs a node may use and the dataset to fall back to when a key`,
    `is missing. Wire real calls in \`runtime/tool-adapters.ts\`. See \`tools/\`.`,
    ``,
    `## How datasets are used`,
    ``,
    `Source nodes use Input Studio datasets (\`datasets/\`) — deliberate, reusable seed data, not`,
    `mock junk. Replace a dataset source with a live API by implementing its adapter.`,
    ``,
    `## How Handoff Packets work`,
    ``,
    `Each Team Node hands a slim packet downstream (\`packets/\`). Field-drift warnings flag data lost`,
    `between teams.`,
    ``,
    `## How output tables power the UI`,
    ``,
    `Output tables (\`tables/\`) are bound to UI components (\`ui/ui-bindings.json\`). \`ui/ui-preview.json\``,
    `shows each surface with the table + sample rows that power it.`,
    ``,
    `## Integrate into another app`,
    ``,
    `Import \`runtime/flowmind-runtime.ts\` and call \`runFlowmindPipeline({ pipeline, input })\`, or call`,
    `the hosted endpoint (see \`docs/api-docs.md\`).`,
    ``,
    `## Files`,
    ``,
    `- \`pipeline/\` — graph, product drop, reality meter, source/brain/surface.`,
    `- \`schemas/\` — JSON descriptors for every object type.`,
    `- \`agents/\`, \`crews/\` — per-node + per-team definitions.`,
    `- \`tools/\`, \`models/\`, \`datasets/\`, \`contracts/\` — registry + source layer.`,
    `- \`packets/\`, \`tables/\`, \`ui/\`, \`runs/\`, \`takes/\`, \`evals/\` — execution + product data.`,
    `- \`runtime/\` — runnable example + portable runtime + adapter stubs.`,
    `- \`docs/\` — client blueprint, founder brief, implementation plan, API docs.`,
    `- \`export-manifest.json\` — every file + the export health check.`,
    ``,
    `## Limitations`,
    ``,
    `The portable runtime runs in **simulate** mode (deterministic, dataset-backed). Live model + tool`,
    `calls require wiring the adapters. ${ctx.reality.missing?.length ? `Missing for production: ${ctx.reality.missing.join(", ")}.` : ""}`,
    ``,
  ].join("\n");
}

export function specMd(ctx: DocsContext): string {
  const p = ctx.pipeline;
  const edges = p.edges.map((e) => `- \`${e.source}\` → \`${e.target}\`${e.dataKey ? ` (\`${e.dataKey}\`)` : ""}`).join("\n");
  const teams = p.nodes.filter((n) => n.team);
  return [
    `# ${ctx.drop.name} — Spec`,
    ``,
    `## Overview`,
    ``,
    ctx.drop.pitch || p.description || "_No description._",
    ``,
    `**Target user:** ${ctx.drop.targetUser || "—"}  `,
    `**Core value:** ${ctx.drop.coreValue || "—"}`,
    ``,
    `## Source / Brain / Surface`,
    ``,
    `- **Source:** ${ctx.drop.keySources?.join(", ") || "—"}`,
    `- **Brain:** ${ctx.drop.keyTeams?.join(", ") || "—"}`,
    `- **Surface:** ${ctx.drop.keySurfaces?.join(", ") || "—"}`,
    ``,
    `## Canvas graph`,
    ``,
    edges || "_No edges._",
    ``,
    `## Teams & agents`,
    ``,
    ...(teams.length
      ? teams.map(
          (n) =>
            `- **${n.title}** (${n.team?.strategy}) — agents: ${n.team?.agents.map((a) => a.name || a.role || a.id).join(", ")}`,
        )
      : ["_No team nodes._"]),
    ``,
    `## Output tables`,
    ``,
    bullets(p.outputTables.map((t) => `\`${t.name}\` (${t.columns.length} cols)`)),
    ``,
    `## UI preview`,
    ``,
    bullets(p.uiBindings.map((b) => `\`${b.tableId}\` → ${b.componentType}${b.title ? ` (${b.title})` : ""}`)),
    ``,
    `## Models`,
    ``,
    ...p.nodes.map((n) => {
      const rec = recommendModelForNode({
        nodeId: n.id,
        nodeType: n.type,
        role: n.role || n.title,
        structuredOutputRequired: true,
        toolUsageRequired: Boolean(n.source?.toolId || n.toolAttachments.length),
        wiredOnly: true,
      });
      return `- **${n.title}**: \`${n.modelSelection?.primaryModelId ?? n.model}\` — ${rec.reason}`;
    }),
    ``,
    `## Reality Meter`,
    ``,
    `**${ctx.reality.buildability}%** (${ctx.reality.label ?? "—"}). Hardest part: ${ctx.reality.hardestPart}. Fastest MVP: ${ctx.reality.fastestMvpPath}.`,
    ctx.reality.missing?.length ? `\nMissing: ${ctx.reality.missing.join(", ")}.` : "",
    ``,
  ].join("\n");
}

export function clientBlueprintMd(ctx: DocsContext): string {
  const p = ctx.pipeline;
  const teams = p.nodes.filter((n) => n.team);
  const example = ctx.finalOutput?.summary || p.outputTables[p.outputTables.length - 1]?.rows[0];
  return [
    `# ${ctx.drop.name} — Client Blueprint`,
    ``,
    `## One-line pitch`,
    ctx.drop.pitch || p.description,
    ``,
    `## Who it serves`,
    ctx.drop.targetUser || "—",
    ``,
    `## What it does`,
    ctx.drop.coreValue || ctx.drop.workflowSummary || p.description,
    ``,
    `## How the AI system works`,
    ctx.drop.workflowSummary || "Source → Brain → Surface.",
    ``,
    `## Team map`,
    bullets((teams.length ? teams : p.nodes).map((n) => `**${n.title}**${n.team ? ` (${n.team.strategy})` : ""} — ${n.description || n.role}`)),
    ``,
    `## Data sources needed`,
    bullets(ctx.drop.keySources ?? []),
    ``,
    `## What data is created`,
    bullets(p.outputTables.map((t) => `\`${t.name}\` — ${t.description || `${t.columns.length} columns`}`)),
    ``,
    `## UI preview`,
    bullets(p.uiBindings.map((b) => `${b.title || b.componentType} (powered by \`${b.tableId}\`)`)),
    ``,
    `## Example result`,
    typeof example === "string" ? example : example ? "```json\n" + JSON.stringify(example, null, 2) + "\n```" : "_Run the pipeline to see an example._",
    ``,
    `## Required integrations`,
    bullets(ctx.reality.missing ?? ctx.drop.missingApis ?? []),
    ``,
    `## Implementation phases`,
    `1. Prototype with Input Studio data.`,
    `2. Wire live sources/APIs.`,
    `3. Turn on real execution + evals.`,
    `4. Integrate the UI surfaces.`,
    `5. Harden for production.`,
    ``,
    `## Reality Meter`,
    `**${ctx.reality.buildability}% — ${ctx.reality.label ?? "—"}.** Hardest part: ${ctx.reality.hardestPart}.`,
    ``,
    `## Risks / missing pieces`,
    bullets([...(ctx.reality.missing ?? []), ...(ctx.reality.missingData ?? [])]),
    ``,
    `## Next steps`,
    bullets(ctx.brief.nextSteps),
    ``,
  ].join("\n");
}

export function founderBriefMd(ctx: DocsContext): string {
  const r = ctx.reality;
  return [
    `# ${ctx.drop.name} — Founder Brief`,
    ``,
    `**Target customer:** ${ctx.drop.targetUser || "—"}`,
    ``,
    `## Pain point`,
    ctx.drop.coreValue ? `Solves: ${ctx.drop.coreValue}` : ctx.drop.pitch,
    ``,
    `## Core value`,
    ctx.drop.coreValue || ctx.drop.pitch,
    ``,
    `## MVP scope`,
    r.fastestMvpPath || "Run the core loop on controlled inputs.",
    ``,
    `## What to fake first`,
    bullets(r.fakeFirst ?? []),
    ``,
    `## What to automate later`,
    bullets(r.automateLater ?? []),
    ``,
    `## Monetization ideas`,
    ctx.drop.monetizationAngle || ctx.drop.monetization || "Subscription for power users; usage-based for teams.",
    ``,
    `## Fastest test`,
    r.fastestMvpPath || "Ship the simulate flow to 5 users with seed data.",
    ``,
    `## Differentiation`,
    `${ctx.drop.category || "AI system"} — connected architecture (teams, sources, tables, UI), not a chatbot.`,
    ``,
    `## Complexity / Reality Meter`,
    `**${r.buildability}% — ${r.label ?? "—"}.** Complexity risk: ${r.complexityRisk}. Cost risk: ${r.costRisk}.`,
    ``,
    `## Required data / APIs`,
    bullets(r.missing ?? []),
    ``,
    `## Launch path`,
    `Fake: ${(r.fakeFirst ?? []).join(", ") || "—"} → Automate: ${(r.automateLater ?? []).join(", ") || "—"}.`,
    ``,
    `## Next 5 moves`,
    bullets([r.recommendedNextFeature || r.recommendedNext, ...ctx.brief.nextSteps].filter(Boolean).slice(0, 5)),
    ``,
  ].join("\n");
}

export function implementationPlanMd(ctx: DocsContext): string {
  const p = ctx.pipeline;
  const toolIds = Array.from(new Set(p.nodes.flatMap((n) => [n.source?.toolId, ...n.toolAttachments.map((a) => a.toolId)]).filter(Boolean) as string[]));
  return [
    `# ${ctx.drop.name} — Implementation Plan`,
    ``,
    `## Phase 1 — Prototype (controlled inputs)`,
    `Run in simulate mode with Input Studio datasets. Validate the graph + output tables + UI bindings.`,
    ``,
    `## Phase 2 — Live source integration`,
    bullets(toolIds.map((id) => `Wire ${getTool(id)?.name ?? id} in \`runtime/tool-adapters.ts\``), "No external sources required."),
    ``,
    `## Phase 3 — Real execution + evals`,
    `Wire \`runtime/model-adapters.ts\` (e.g. Anthropic). Turn on evaluator nodes; compare Takes on quality vs. cost.`,
    ``,
    `## Phase 4 — UI integration`,
    `Render output tables via the UI bindings in \`ui/\`. Start from \`ui/ui-preview.json\`.`,
    ``,
    `## Phase 5 — Production hardening`,
    `Add auth + rate limiting to the hosted run endpoint, persistence for runs/takes, and monitoring.`,
    ``,
    `## Required APIs`,
    bullets(ctx.reality.missing ?? []),
    ``,
    `## Model / tool setup`,
    `Models: see \`models/\`. Tools: \`tools/tool-definitions.json\` + adapters.`,
    ``,
    `## Data storage`,
    `Datasets persist as JSON here; in production use a database (Supabase wired in the app).`,
    ``,
    `## Testing / evals`,
    `Eval scores in \`evals/eval-scores.json\`. Re-run + compare Takes after each change.`,
    ``,
    `## Deployment`,
    `Deploy the host app (Next.js) or embed the portable runtime. Set env vars from \`.env.example\`.`,
    ``,
  ].join("\n");
}

export function apiDocsMd(ctx: DocsContext): string {
  const p = ctx.pipeline;
  const exampleInput = Object.fromEntries(p.mockInputs.map((f) => [f.key, f.value]));
  return [
    `# ${ctx.drop.name} — API`,
    ``,
    "```",
    `POST /api/pipelines/${p.id}/run`,
    "```",
    ``,
    `Runs the exported pipeline with the given input and returns the final output, output tables,`,
    `handoff packets, and a trace summary.`,
    ``,
    `## Request body`,
    "```json",
    JSON.stringify({ input: exampleInput, mode: "simulate", takeName: "API run" }, null, 2),
    "```",
    ``,
    `## Response body`,
    "```json",
    JSON.stringify(
      {
        runId: "run_…",
        takeId: "take_…",
        status: "success",
        finalOutput: { title: "…", summary: "…", highlights: [] },
        outputTables: p.outputTables.map((t) => ({ name: t.name, rowCount: t.rows.length })),
        handoffPackets: [],
        traceSummary: { totalCostUsd: 0, totalLatencyMs: 0, warningCount: 0 },
        warnings: [],
      },
      null,
      2,
    ),
    "```",
    ``,
    `## Environment`,
    `\`ANTHROPIC_API_KEY\` for live/hybrid; simulate needs no keys. Plus any tool keys in \`.env.example\`.`,
    ``,
    `## Auth`,
    `**This route ships without auth.** Add authentication + rate limiting before exposing it publicly.`,
    ``,
    `## Example — curl`,
    "```bash",
    `curl -X POST https://your-app/api/pipelines/${p.id}/run \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify({ input: exampleInput, mode: "simulate" })}'`,
    "```",
    ``,
    `## Example — fetch`,
    "```ts",
    `const res = await fetch("/api/pipelines/${p.id}/run", {`,
    `  method: "POST",`,
    `  headers: { "Content-Type": "application/json" },`,
    `  body: JSON.stringify({ input: ${JSON.stringify(exampleInput)}, mode: "simulate" }),`,
    `});`,
    `const result = await res.json();`,
    "```",
    ``,
  ].join("\n");
}

export function modelRouterNotesMd(pipeline: Pipeline): string {
  return [
    `# Model Router Notes`,
    ``,
    `Flowmind is provider-agnostic. Each node/agent has a model selection (auto / manual / fallback).`,
    `\`model-recommendations.json\` shows the recommended model + reason per node; \`model-selections.json\``,
    `shows what's actually chosen. Wire providers in \`runtime/model-adapters.ts\`.`,
    ``,
    ...pipeline.nodes.map((n) => `- **${n.title}**: ${n.modelSelection?.mode ?? "auto"} → \`${n.modelSelection?.primaryModelId ?? n.model}\``),
    ``,
  ].join("\n");
}

export function productBriefMd(brief: ProductBrief): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "_None_");
  return [
    `# ${brief.title} — Product Brief`,
    ``,
    brief.summary,
    ``,
    brief.targetUser ? `**Target user:** ${brief.targetUser}` : "",
    `## How it works`,
    list(brief.howItWorks),
    `## Data needed`,
    list(brief.dataNeeded),
    `## AI teams`,
    list(brief.aiTeams),
    `## UI surfaces`,
    list(brief.uiSurfaces),
    `## Missing pieces`,
    list(brief.missingPieces),
    `## Next steps`,
    list(brief.nextSteps),
    ``,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export type { ProductDrop, RealityMeter };
