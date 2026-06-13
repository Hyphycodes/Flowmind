import JSZip from "jszip";
import { saveAs } from "file-saver";
import type {
  AgentRunTrace,
  FinalOutput,
  HandoffPacket,
  OutputTable,
  PacketWarning,
  Pipeline,
  RunTrace,
  Take,
  TeamRunTrace,
} from "./schema";
import type { Dataset } from "@/lib/datasets/schema";
import type { EvalResult } from "@/lib/evals/schema";
import { MODELS } from "@/lib/models/providers";
import { recommendModelForAgent, recommendModelForNode } from "@/lib/models/recommend";
import { getTool, TOOLS } from "@/lib/tools/registry";
import { compareTakes, summarizeRunCost } from "@/lib/takes/build";
import { generateProductDrop } from "@/lib/product/productDrop";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { generateProductBrief } from "@/lib/product/brief";

function productBriefMd(brief: ReturnType<typeof generateProductBrief>): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "_None_");
  return [
    `# ${brief.title} — Product Brief`,
    ``,
    brief.summary,
    ``,
    brief.targetUser ? `**Target user:** ${brief.targetUser}` : "",
    ``,
    `## How it works`,
    list(brief.howItWorks),
    ``,
    `## Data needed`,
    list(brief.dataNeeded),
    ``,
    `## AI teams`,
    list(brief.aiTeams),
    ``,
    `## UI surfaces`,
    list(brief.uiSurfaces),
    ``,
    `## Missing pieces`,
    list(brief.missingPieces),
    ``,
    `## Next steps`,
    list(brief.nextSteps),
    ``,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export type ExportRun = {
  steps?: unknown;
  tables?: OutputTable[];
  finalOutput?: FinalOutput | null;
  packets?: HandoffPacket[];
  packetWarnings?: PacketWarning[];
  agentRuns?: AgentRunTrace[];
  teamRuns?: TeamRunTrace[];
  toolTraces?: unknown[];
  runTrace?: RunTrace | null;
  datasets?: Dataset[];
  takes?: Take[];
  evalResults?: EvalResult[];
};

const ENV_EXAMPLE = [
  "ANTHROPIC_API_KEY=",
  "OPENAI_API_KEY=",
  "GOOGLE_GENERATIVE_AI_API_KEY=",
  "VERCEL_AI_GATEWAY_API_KEY=",
  "OPENROUTER_API_KEY=",
  "GROQ_API_KEY=",
  "CEREBRAS_API_KEY=",
  "MISTRAL_API_KEY=",
  "GOOGLE_PLACES_API_KEY=",
  "SERPAPI_API_KEY=",
  "RENTCAST_API_KEY=",
  "ATTOM_API_KEY=",
  "NEXT_PUBLIC_SUPABASE_URL=",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
  "SUPABASE_SERVICE_ROLE_KEY=",
].join("\n");

function clientBlueprintMd(p: Pipeline): string {
  const b = p.blueprint;
  const teams = p.nodes.filter((n) => n.team);
  return [
    `# ${b?.name || p.name} — Client Blueprint`,
    ``,
    b?.pitch || p.description,
    ``,
    `## What it does`,
    b?.workflowSummary || p.description,
    ``,
    `## Teams`,
    ...(teams.length
      ? teams.map((n) => `- **${n.title}** (${n.team?.strategy}) — ${n.description}`)
      : p.nodes.map((n) => `- **${n.title}** — ${n.description}`)),
    ``,
    `## Data created`,
    ...p.outputTables.map((t) => `- \`${t.name}\` (${t.columns.length} cols)`),
    ``,
    `## UI surfaces`,
    ...(b?.uiSurfaces?.length
      ? b.uiSurfaces.map((s) => `- ${s}`)
      : p.uiBindings.map((u) => `- ${u.title} (${u.componentType})`)),
    ``,
    `## APIs needed`,
    ...(b?.missingApis?.length ? b.missingApis.map((a) => `- ${a}`) : ["- _None declared_"]),
    ``,
    p.realityMeter
      ? `## Reality Meter\n- Buildability: ${p.realityMeter.buildability}/100\n- Hardest part: ${p.realityMeter.hardestPart}\n- Fastest MVP: ${p.realityMeter.fastestMvpPath}`
      : "",
    ``,
  ].join("\n");
}

function founderBriefMd(p: Pipeline): string {
  const b = p.blueprint;
  return [
    `# ${b?.name || p.name} — Founder Brief`,
    ``,
    `**Pitch:** ${b?.pitch || p.description}`,
    `**Target customer:** ${b?.targetUser || "—"}`,
    `**Core value:** ${b?.coreValue || "—"}`,
    ``,
    `## MVP scope`,
    b?.fastestMvpPath || p.realityMeter?.fastestMvpPath || "—",
    ``,
    `## Monetization`,
    b?.monetization || "—",
    ``,
    `## Risks`,
    p.realityMeter
      ? `- Cost: ${p.realityMeter.costRisk}\n- Complexity: ${p.realityMeter.complexityRisk}\n- Data quality: ${p.realityMeter.dataQualityRisk}`
      : "- _Not assessed_",
    ``,
    `## Launch path`,
    `Fake first: ${p.realityMeter?.fakeFirst?.join(", ") || "—"}. ` +
      `Automate later: ${p.realityMeter?.automateLater?.join(", ") || "—"}.`,
    ``,
  ].join("\n");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pipeline"
  );
}

function runnerTs(p: Pipeline): string {
  return [
    `/**`,
    ` * Standalone runner for "${p.name}".`,
    ` * Topologically executes nodes. Replace runNode() with real model/tool calls.`,
    ` *`,
    ` *   npx tsx run-pipeline.ts`,
    ` */`,
    `import pipeline from "./pipeline.json";`,
    `import mock from "./mock-data.json";`,
    ``,
    `type Node = (typeof pipeline)["nodes"][number];`,
    ``,
    `function topoOrder(): string[] {`,
    `  const indeg: Record<string, number> = {};`,
    `  const adj: Record<string, string[]> = {};`,
    `  for (const n of pipeline.nodes) { indeg[n.id] = 0; adj[n.id] = []; }`,
    `  for (const e of pipeline.edges) { adj[e.source]?.push(e.target); indeg[e.target]++; }`,
    `  const q = pipeline.nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id);`,
    `  const order: string[] = [];`,
    `  while (q.length) {`,
    `    const u = q.shift()!; order.push(u);`,
    `    for (const v of adj[u] ?? []) { if (--indeg[v] === 0) q.push(v); }`,
    `  }`,
    `  return order;`,
    `}`,
    ``,
    `// TODO: wire this to your model/provider (e.g. the Anthropic API).`,
    `async function runNode(node: Node, inputs: Record<string, unknown>) {`,
    `  console.log("→", node.title, "(" + node.type + ")");`,
    `  // Mock: echo the seeded table for this node's first output, if any.`,
    `  const key = node.outputs?.[0];`,
    `  const seeded = (mock.tables ?? []).find((t: any) => t.id === key);`,
    `  return { [key ?? node.id]: seeded ?? null };`,
    `}`,
    ``,
    `async function main() {`,
    `  const order = topoOrder();`,
    `  const outputs: Record<string, unknown> = {};`,
    `  for (const id of order) {`,
    `    const node = pipeline.nodes.find((n) => n.id === id)!;`,
    `    const res = await runNode(node, outputs);`,
    `    Object.assign(outputs, res);`,
    `  }`,
    `  console.log("\\nFinal output:\\n", JSON.stringify(mock.finalOutput ?? outputs, null, 2));`,
    `}`,
    ``,
    `main();`,
    ``,
  ].join("\n");
}

function readmeMd(p: Pipeline): string {
  const nodeList = p.nodes
    .map((n) => `- **${n.title}** (\`${n.type}\`)${n.role ? ` — ${n.role}` : ""}`)
    .join("\n");
  const tableList = p.outputTables.map((t) => `- \`${t.name}\``).join("\n");
  return [
    `# ${p.name}`,
    ``,
    p.description || "An exported Flowmind agent pipeline.",
    ``,
    `## Nodes`,
    ``,
    nodeList,
    ``,
    `## Output tables`,
    ``,
    tableList || "_None_",
    ``,
    `## Run the mock`,
    ``,
    "```bash",
    `npm i -D tsx`,
    `npx tsx run-pipeline.ts`,
    "```",
    ``,
    `## Replace mock nodes with real calls`,
    ``,
    `Open \`run-pipeline.ts\` and implement \`runNode()\` for each agent — call your model`,
    `provider (e.g. the Anthropic API) with each node's \`prompt\`, passing the upstream`,
    `outputs as context, and return structured rows for the node's output table(s).`,
    ``,
    `## Team Nodes and Packet View`,
    ``,
    `Team Nodes run internal agents, emit Handoff Packets, and save agent/team traces. Use Packet View plus the trace files to debug what changed between teams.`,
    ``,
    `## Models and tools`,
    ``,
    `Every node can auto-pick a model, use a manual model, or keep a fallback chain. Tool attachments declare which APIs a node may use and which Input Studio dataset to fall back to when an API key is missing.`,
    ``,
    `## Input Studio & the Source Layer`,
    ``,
    `Source nodes don't use "mock data" — they use the **Input Studio**: deliberate, reusable`,
    `**Generated Datasets** (Seed Datasets) with an inferred schema and a quality score. Each source`,
    `declares a **Source Mode** (Input Studio, Live API, Previous Take, …). **Data Contracts** check`,
    `that a source provides the fields the next team expects; **field mappings** reconcile differing`,
    `names (e.g. \`parking_notes\` → \`parking\`); **Scenario Sets** swap datasets per test condition.`,
    ``,
    `## Execution, Takes & Evals`,
    ``,
    `Runs execute in a **mode** — \`simulate\` (datasets / deterministic), \`live\` (real models + tools),`,
    `or \`hybrid\` (live models, dataset fallbacks for missing APIs). Every full run becomes a **Take** —`,
    `a saved variation with its run trace, model selections, cost, latency, and **eval scores**. Compare`,
    `Takes (\`takes/comparison.json\`) to see which configuration wins on quality vs. cost vs. speed.`,
    ``,
    `## Files`,
    ``,
    `- \`pipeline.json\` — the validated pipeline graph (nodes, edges, tables, UI bindings).`,
    `- \`agents/*.json\` — one file per node (role, prompt, model, inputs, outputs).`,
    `- \`mock-data.json\` — seeded inputs, tables, and final output.`,
    `- \`run-pipeline.ts\` — standalone topological runner.`,
    `- \`spec.md\` — human-readable architecture spec.`,
    `- \`datasets/*.json\` + \`dataset-schemas.json\` — Input Studio Generated Datasets and their schemas.`,
    `- \`source-configs.json\` — each source node's mode + dataset/tool binding.`,
    `- \`data-contracts.json\` and \`field-mappings.json\` — source/target field contracts and mappings.`,
    `- \`scenario-sets.json\` — reusable testing scenarios.`,
    `- \`models/model-configs.json\`, \`models/model-selections.json\`, \`models/model-recommendations.json\` — model router setup.`,
    `- \`tools/tool-definitions.json\`, \`tools/tool-attachments.json\`, \`tools/tool-traces.json\` — tool registry setup and run usage.`,
    `- \`env.example\` — environment variable names to configure; no secret values are exported.`,
    `- \`traces/team-runs.json\`, \`traces/agent-runs.json\`, \`traces/tool-traces.json\` — execution records.`,
    `- \`packets/handoff-packets.json\` and \`packets/field-drift-warnings.json\` — packet timeline plus drift warnings.`,
    `- \`takes/*.json\` + \`takes/comparison.json\` — saved run variations and their comparison.`,
    `- \`evals/eval-scores.json\` and \`costs/cost-trace.json\` — eval dimension scores and cost/latency trace.`,
    `- \`product/product-drop.json\`, \`product/reality-meter.json\`, \`product/product-brief.md\` — the product concept, buildability, and brief.`,
    `- \`product/product-variations.json\` and \`product/remix-proposals.json\` — remix history + product variations.`,
    `- \`preview/ui-preview.json\` — each UI surface with the table + sample rows that power it.`,
    ``,
  ].join("\n");
}

function specMd(p: Pipeline): string {
  const edges = p.edges
    .map((e) => `- \`${e.source}\` → \`${e.target}\`${e.dataKey ? ` (\`${e.dataKey}\`)` : ""}`)
    .join("\n");
  const bindings = p.uiBindings
    .map((b) => `- \`${b.tableId}\` → **${b.componentType}** (${b.title || "untitled"})`)
    .join("\n");
  const drop = generateProductDrop(p);
  const reality = calculateRealityMeter(p);
  return [
    `# ${p.name} — Spec`,
    ``,
    `## Overview`,
    ``,
    p.description || "_No description._",
    ``,
    `## Product`,
    ``,
    `**${drop.name}** — ${drop.pitch}`,
    drop.targetUser ? `Target user: ${drop.targetUser}.` : "",
    `Source: ${drop.keySources?.join(", ") || "—"}. Brain: ${drop.keyTeams?.join(", ") || "—"}. Surface: ${drop.keySurfaces?.join(", ") || "—"}.`,
    `**Reality Meter: ${reality.buildability}%** (${reality.label ?? "—"}).${reality.missing?.length ? ` Missing: ${reality.missing.join(", ")}.` : ""} Fastest MVP: ${reality.fastestMvpPath}. Next: ${reality.recommendedNextFeature ?? reality.recommendedNext}.`,
    ``,
    `## Data flow`,
    ``,
    edges || "_No edges._",
    ``,
    `## UI bindings`,
    ``,
    bindings || "_No UI bindings._",
    ``,
    `## Source Layer`,
    ``,
    `Source nodes declare where their data comes from via a Source Mode ` +
      `(Input Studio, Live API, Previous Take, Upload, Manual, Memory, Webhook, Database).`,
    ...(p.nodes.filter((n) => n.source).length
      ? p.nodes
          .filter((n) => n.source)
          .map(
            (n) =>
              `- **${n.title}** — \`${n.source?.mode}\`${n.source?.datasetName ? ` · dataset: ${n.source.datasetName}` : ""}${n.source?.scenario ? ` · scenario: ${n.source.scenario}` : ""}`,
          )
      : ["- _No source nodes._"]),
    ``,
    `Data Contracts (\`data-contracts.json\`) declare what each source provides and what the next`,
    `team expects; field mappings (\`field-mappings.json\`) reconcile differing field names; scenario`,
    `sets (\`scenario-sets.json\`) swap datasets for different test conditions. Datasets and their`,
    `inferred schemas live in \`datasets/*.json\` + \`dataset-schemas.json\`.`,
    ``,
    `## Schema`,
    ``,
    `Each node: \`{ id, type, title, role, prompt, model, inputs[], outputs[], team? }\`.`,
    `A node may carry an optional \`team\` (strategy + agents[]) for multi-agent execution.`,
    `Output tables: \`{ id, name, sourceNodeId, columns[], rows[] }\`.`,
    `Team traces capture agent runs, consultation summaries, disagreements, merge decisions, final team output, and emitted Handoff Packets.`,
    `Debug a bad output by checking \`traces/team-runs.json\`, then the matching \`traces/agent-runs.json\`, then \`packets/field-drift-warnings.json\`.`,
    ``,
    `## Models and tools`,
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
      return `- **${n.title}** model: \`${n.modelSelection?.primaryModelId ?? n.model ?? rec.recommendedModelId}\` · ${rec.reason}`;
    }),
    ``,
  ].join("\n");
}

/** Build + download a zip of the pipeline and its latest run. */
export async function exportPipeline(pipeline: Pipeline, run?: ExportRun | null): Promise<void> {
  const zip = new JSZip();
  zip.file("pipeline.json", JSON.stringify(pipeline, null, 2));

  const agents = zip.folder("agents");
  if (agents) {
    for (const n of pipeline.nodes) {
      agents.file(
        `${n.id}.json`,
        JSON.stringify(
          {
            id: n.id,
            type: n.type,
            title: n.title,
            role: n.role,
            prompt: n.prompt,
            model: n.model,
            modelSelection: n.modelSelection ?? null,
            toolAttachments: n.toolAttachments,
            inputs: n.inputs,
            outputs: n.outputs,
            team: n.team ?? null,
          },
          null,
          2,
        ),
      );
    }
  }

  zip.file(
    "mock-data.json",
    JSON.stringify(
      {
        inputs: pipeline.mockInputs,
        tables: run?.tables ?? pipeline.outputTables,
        finalOutput: run?.finalOutput ?? null,
      },
      null,
      2,
    ),
  );
  zip.file("run-pipeline.ts", runnerTs(pipeline));
  zip.file("README.md", readmeMd(pipeline));
  zip.file("spec.md", specMd(pipeline));

  // ── upgraded manifest ────────────────────────────────────────────────
  zip.file(
    "schema.json",
    JSON.stringify(
      {
        nodes: pipeline.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          layer: n.layer ?? null,
          inputs: n.inputs,
          outputs: n.outputs,
          isTeam: !!n.team,
          modelSelection: n.modelSelection ?? null,
          toolAttachments: n.toolAttachments,
        })),
        edges: pipeline.edges.map((e) => ({
          source: e.source,
          target: e.target,
          dataKey: e.dataKey ?? null,
          contract: e.contract ?? null,
          packetId: e.packetId ?? null,
        })),
        tables: pipeline.outputTables.map((t) => ({ id: t.id, columns: t.columns })),
      },
      null,
      2,
    ),
  );

  const crews = zip.folder("crews");
  for (const n of pipeline.nodes) {
    if (!n.team) continue;
    crews?.file(
      `${n.id}.json`,
      JSON.stringify(
        {
          nodeId: n.id,
          title: n.title,
          strategy: n.team.strategy,
          lead: n.team.lead ?? null,
          agents: n.team.agents,
          internalEdges: n.team.internalEdges,
        },
        null,
        2,
      ),
    );
  }

  const toolIds = Array.from(
    new Set(
      pipeline.nodes.flatMap((n) => [
        n.source?.toolId,
        ...n.toolAttachments.map((a) => a.toolId),
        ...(n.team?.toolAttachments.map((a) => a.toolId) ?? []),
        ...(n.team?.agents.flatMap((a) => a.toolAttachments.map((attachment) => attachment.toolId)) ?? []),
      ]).filter(Boolean) as string[],
    ),
  );
  if (toolIds.length) {
    const tools = zip.folder("tools");
    for (const id of toolIds) {
      const def = getTool(id);
      if (def) tools?.file(`${id}.json`, JSON.stringify(def, null, 2));
    }
  }

  const datasets = run?.datasets ?? [];
  if (datasets.length) {
    const ds = zip.folder("datasets");
    for (const d of datasets) ds?.file(`${d.id}.json`, JSON.stringify(d, null, 2));
  }

  // ── Source Layer manifest (Input Studio / contracts / mappings / scenarios) ──
  zip.file(
    "dataset-schemas.json",
    JSON.stringify(
      datasets.map((d) => ({
        id: d.id,
        name: d.name,
        mode: d.mode,
        rowCount: d.rows.length,
        qualityScore: d.qualityScore ?? null,
        scenarioTags: d.scenarioTags,
        requiredFields: d.requiredFields,
        schema: d.schema,
      })),
      null,
      2,
    ),
  );
  zip.file(
    "source-configs.json",
    JSON.stringify(
      pipeline.nodes
        .filter((n) => n.source)
        .map((n) => ({ nodeId: n.id, title: n.title, ...n.source })),
      null,
      2,
    ),
  );
  zip.file(
    "data-contracts.json",
    JSON.stringify(
      pipeline.edges
        .filter((e) => e.contract)
        .map((e) => ({ id: e.id, fromNodeId: e.source, toNodeId: e.target, ...e.contract })),
      null,
      2,
    ),
  );
  zip.file("field-mappings.json", JSON.stringify(pipeline.fieldMappings ?? [], null, 2));
  zip.file("scenario-sets.json", JSON.stringify(pipeline.scenarioSets ?? [], null, 2));

  const models = zip.folder("models");
  models?.file("model-configs.json", JSON.stringify(MODELS, null, 2));
  models?.file(
    "model-selections.json",
    JSON.stringify(
      pipeline.nodes.map((node) => ({
        nodeId: node.id,
        nodeTitle: node.title,
        selection: node.modelSelection ?? null,
        teamSelection: node.team?.modelSelection ?? null,
        agentSelections: node.team?.agents.map((agent) => ({
          agentId: agent.id,
          agentName: agent.name,
          selection: agent.modelSelection ?? null,
        })) ?? [],
      })),
      null,
      2,
    ),
  );
  models?.file(
    "model-recommendations.json",
    JSON.stringify(
      pipeline.nodes.map((node) => ({
        nodeId: node.id,
        nodeTitle: node.title,
        recommendation: recommendModelForNode({
          nodeId: node.id,
          nodeType: node.type,
          role: node.role || node.title,
          structuredOutputRequired: true,
          toolUsageRequired: Boolean(node.source?.toolId || node.toolAttachments.length),
          wiredOnly: true,
        }),
        agentRecommendations: node.team?.agents.map((agent) =>
          recommendModelForAgent({
            nodeId: node.id,
            agentId: agent.id,
            nodeType: node.type,
            role: agent.role || node.role,
            structuredOutputRequired: true,
            toolUsageRequired: Boolean(agent.toolAttachments.length || node.toolAttachments.length),
            wiredOnly: true,
          }),
        ) ?? [],
      })),
      null,
      2,
    ),
  );

  const toolFolder = zip.folder("tools");
  toolFolder?.file("tool-definitions.json", JSON.stringify(TOOLS, null, 2));
  toolFolder?.file(
    "tool-attachments.json",
    JSON.stringify(
      pipeline.nodes.map((node) => ({
        nodeId: node.id,
        nodeTitle: node.title,
        attachments: node.toolAttachments,
        teamAttachments: node.team?.toolAttachments ?? [],
        agentAttachments: node.team?.agents.map((agent) => ({
          agentId: agent.id,
          agentName: agent.name,
          attachments: agent.toolAttachments,
        })) ?? [],
      })),
      null,
      2,
    ),
  );
  toolFolder?.file("tool-traces.json", JSON.stringify(run?.runTrace?.toolTraces ?? [], null, 2));
  zip.file("env.example", ENV_EXAMPLE + "\n");

  zip.file("ui-bindings.json", JSON.stringify(pipeline.uiBindings, null, 2));
  zip.file("handoff-packets.json", JSON.stringify(run?.packets ?? [], null, 2));

  const traces = zip.folder("traces");
  traces?.file("team-runs.json", JSON.stringify(run?.teamRuns ?? [], null, 2));
  traces?.file("agent-runs.json", JSON.stringify(run?.agentRuns ?? [], null, 2));

  const packets = zip.folder("packets");
  packets?.file("handoff-packets.json", JSON.stringify(run?.packets ?? [], null, 2));
  packets?.file("field-drift-warnings.json", JSON.stringify(run?.packetWarnings ?? [], null, 2));

  const runs = zip.folder("runs");
  runs?.file("latest-run-trace.json", JSON.stringify(run?.runTrace ?? null, null, 2));

  traces?.file(
    "tool-traces.json",
    JSON.stringify(run?.toolTraces ?? run?.runTrace?.toolTraces ?? [], null, 2),
  );

  // ── Takes + evals + cost trace (Prompt 05) ──────────────────────────
  const takes = run?.takes ?? [];
  if (takes.length) {
    const takesFolder = zip.folder("takes");
    for (const t of takes) takesFolder?.file(`${t.id}.json`, JSON.stringify(t, null, 2));
    takesFolder?.file("comparison.json", JSON.stringify(compareTakes(takes), null, 2));
  }

  const evalResults = run?.evalResults ?? run?.runTrace?.evalResults ?? [];
  zip.file("evals/eval-scores.json", JSON.stringify(evalResults, null, 2));

  const costTrace = run?.runTrace
    ? summarizeRunCost(run.runTrace)
    : { totalCostUsd: 0, totalLatencyMs: 0, warningCount: 0, modelsUsed: [] };
  zip.file(
    "costs/cost-trace.json",
    JSON.stringify(
      {
        ...costTrace,
        takes: takes.map((t) => ({
          id: t.id,
          name: t.name,
          mode: t.mode,
          overallScore: t.overallScore,
          costUsd: t.costUsd,
          latencyMs: t.latencyMs,
          warningCount: t.warningCount,
        })),
      },
      null,
      2,
    ),
  );

  // ── Product layer (Prompt 06): Product Drop, Reality Meter, Brief, Variations, Remix ──
  const productDrop = generateProductDrop(pipeline);
  const realityMeter = calculateRealityMeter(pipeline, { latestTakeSuccess: run?.runTrace?.status === "success" });
  const productBrief = generateProductBrief(pipeline, productDrop, realityMeter);
  zip.file("product/product-drop.json", JSON.stringify(productDrop, null, 2));
  zip.file("product/reality-meter.json", JSON.stringify(realityMeter, null, 2));
  zip.file("product/product-brief.md", productBriefMd(productBrief));
  zip.file("product/product-variations.json", JSON.stringify(pipeline.productVariations ?? [], null, 2));
  zip.file("product/remix-proposals.json", JSON.stringify(pipeline.remixProposals ?? [], null, 2));

  // ── Preview (Data → UI) ──
  const previewTables = run?.tables ?? pipeline.outputTables;
  zip.file("preview/ui-bindings.json", JSON.stringify(pipeline.uiBindings, null, 2));
  zip.file(
    "preview/ui-preview.json",
    JSON.stringify(
      pipeline.uiBindings
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((b) => {
          const table = previewTables.find((t) => t.id === b.tableId);
          return {
            componentType: b.componentType,
            title: b.title,
            poweredBy: b.tableId,
            fields: b.fields,
            columns: table?.columns ?? [],
            sampleRows: table?.rows.slice(0, 5) ?? [],
          };
        }),
      null,
      2,
    ),
  );

  if (pipeline.blueprint) {
    zip.file("CLIENT_BLUEPRINT.md", clientBlueprintMd(pipeline));
    zip.file("FOUNDER_BRIEF.md", founderBriefMd(pipeline));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${slugify(pipeline.name)}.zip`);
}
