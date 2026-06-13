import JSZip from "jszip";
import { saveAs } from "file-saver";
import type {
  AgentRunTrace,
  FinalOutput,
  HandoffPacket,
  OutputTable,
  PacketWarning,
  Pipeline,
  ProductBrief,
  ProductDrop,
  RealityMeter,
  RunTrace,
  Take,
  TeamRunTrace,
} from "@/lib/pipeline/schema";
import type { Dataset } from "@/lib/datasets/schema";
import type { EvalResult } from "@/lib/evals/schema";
import { newId } from "@/lib/pipeline/validate";
import { MODELS } from "@/lib/models/providers";
import { recommendModelForAgent, recommendModelForNode } from "@/lib/models/recommend";
import { TOOLS } from "@/lib/tools/registry";
import { compareTakes, summarizeRunCost } from "@/lib/takes/build";
import { generateProductDrop } from "@/lib/product/productDrop";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { generateProductBrief } from "@/lib/product/brief";
import { packetTimeline } from "@/lib/packets/packetUtils";
import {
  apiDocsMd,
  clientBlueprintMd,
  deriveEnvExample,
  founderBriefMd,
  implementationPlanMd,
  modelRouterNotesMd,
  productBriefMd,
  readmeMd,
  specMd,
  type DocsContext,
} from "./docs";
import {
  FLOWMIND_RUNTIME_TS,
  MODEL_ADAPTERS_TS,
  RUN_PIPELINE_TS,
  RUNTIME_TYPES_TS,
  TSCONFIG_JSON,
  exampleInputJson,
  exampleOutputJson,
  packageJson,
  toolAdaptersTs,
} from "./runtime";
import { buildExportHealthCheck } from "./healthCheck";
import {
  type ExportFileType,
  type ExportManifest,
  type ExportManifestFile,
  type ExportMode,
} from "./schema";

export type ExportContext = {
  pipeline: Pipeline;
  run?: {
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
  } | null;
  productDrop?: ProductDrop;
  realityMeter?: RealityMeter;
  productBrief?: ProductBrief;
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pipeline";
}

const SCHEMA_DESCRIPTORS: Record<string, { description: string; fields: string[] }> = {
  pipeline: { description: "The full pipeline graph.", fields: ["id", "name", "nodes[]", "edges[]", "outputTables[]", "uiBindings[]", "blueprint", "realityMeter"] },
  dataset: { description: "An Input Studio dataset.", fields: ["id", "name", "mode", "schema[]", "rows[]", "qualityScore", "scenarioTags[]"] },
  "output-table": { description: "Structured data a node produces.", fields: ["id", "name", "sourceNodeId", "columns[]", "rows[]"] },
  "ui-binding": { description: "Connects a table to a UI component.", fields: ["id", "tableId", "componentType", "title", "fields[]"] },
  "handoff-packet": { description: "Slim output a team hands downstream.", fields: ["packetId", "fromNodeId", "toNodeId", "summary", "keyFields", "confidence", "fieldChanges"] },
  tool: { description: "A tool/API definition.", fields: ["id", "name", "category", "authType", "requiredEnv[]", "inputSchema[]", "outputSchema[]"] },
  model: { description: "A model provider config.", fields: ["id", "provider", "displayName", "capabilities[]", "contextTokens", "inputCostPerM", "outputCostPerM", "wired"] },
  "run-trace": { description: "A full execution record.", fields: ["id", "status", "steps[]", "tables[]", "teamRuns[]", "agentRuns[]", "packets[]", "evalResults[]", "costUsd", "latencyMs"] },
};

/** Build the export ZIP for the selected modes, returning the blob + manifest. */
export async function createExportBundle(
  ctx: ExportContext,
  modes: ExportMode[],
): Promise<{ blob: Blob; manifest: ExportManifest; slug: string }> {
  const p = ctx.pipeline;
  const run = ctx.run ?? null;
  const drop = ctx.productDrop ?? generateProductDrop(p);
  const reality = ctx.realityMeter ?? calculateRealityMeter(p, { latestTakeSuccess: run?.runTrace?.status === "success" });
  const brief = ctx.productBrief ?? generateProductBrief(p, drop, reality);
  const docsCtx: DocsContext = { pipeline: p, drop, reality, brief, finalOutput: run?.finalOutput ?? null };

  const has = (m: ExportMode) => modes.includes(m);
  const developer = has("developer");
  const tables = run?.tables ?? p.outputTables;
  const datasets = run?.datasets ?? [];
  const takes = run?.takes ?? [];

  const zip = new JSZip();
  const files: ExportManifestFile[] = [];
  const inferType = (path: string): ExportFileType =>
    path.endsWith(".json") ? "json" : path.endsWith(".md") ? "markdown" : path.endsWith(".ts") || path.endsWith(".tsx") ? "typescript" : "text";
  const put = (path: string, content: string, description?: string) => {
    zip.file(path, content);
    files.push({ path, type: inferType(path), description });
  };
  const json = (path: string, value: unknown, description?: string) => put(path, JSON.stringify(value, null, 2), description);

  // ── always-on core ──
  put("README.md", readmeMd(docsCtx), "How to use this export");
  put("SPEC.md", specMd(docsCtx), "Human-readable architecture spec");
  put(".env.example", deriveEnvExample(p), "Required env vars (no secret values)");
  put("package.json", packageJson(p, slugify(drop.name)), "Run with: npm install && npm start");
  put("tsconfig.json", TSCONFIG_JSON);

  // ── developer package ──
  if (developer) {
    json("pipeline/pipeline.json", p, "The validated pipeline graph");
    json("pipeline/product-blueprint.json", p.blueprint ?? null);
    json("pipeline/product-drop.json", drop);
    json("pipeline/reality-meter.json", reality);
    json("pipeline/source-brain-surface.json", {
      source: p.nodes.filter((n) => n.layer === "source" || n.type === "input" || n.type === "tool").map((n) => n.title),
      brain: p.nodes.filter((n) => n.team || (n.layer === "brain")).map((n) => n.title),
      surface: p.nodes.filter((n) => n.layer === "surface" || n.type === "output").map((n) => n.title),
    });

    for (const [name, d] of Object.entries(SCHEMA_DESCRIPTORS)) json(`schemas/${name}.schema.json`, d);

    for (const n of p.nodes) {
      json(`agents/${n.id}.json`, {
        id: n.id, type: n.type, title: n.title, role: n.role, prompt: n.prompt,
        model: n.model, modelSelection: n.modelSelection ?? null, toolAttachments: n.toolAttachments,
        inputs: n.inputs, outputs: n.outputs, team: n.team ?? null,
      });
    }
    for (const n of p.nodes) {
      if (!n.team) continue;
      json(`crews/${n.id}.json`, { nodeId: n.id, title: n.title, strategy: n.team.strategy, lead: n.team.lead ?? null, agents: n.team.agents, internalEdges: n.team.internalEdges });
    }

    json("tools/tool-definitions.json", TOOLS);
    json("tools/tool-attachments.json", p.nodes.map((n) => ({ nodeId: n.id, attachments: n.toolAttachments, teamAttachments: n.team?.toolAttachments ?? [] })));
    json("tools/tool-traces.json", run?.toolTraces ?? run?.runTrace?.toolTraces ?? []);

    json("models/model-providers.json", Array.from(new Set(MODELS.map((m) => m.provider))));
    json("models/model-definitions.json", MODELS);
    json("models/model-selections.json", p.nodes.map((n) => ({ nodeId: n.id, nodeTitle: n.title, selection: n.modelSelection ?? null, agentSelections: n.team?.agents.map((a) => ({ agentId: a.id, selection: a.modelSelection ?? null })) ?? [] })));
    json("models/model-recommendations.json", p.nodes.map((n) => ({
      nodeId: n.id,
      recommendation: recommendModelForNode({ nodeId: n.id, nodeType: n.type, role: n.role || n.title, structuredOutputRequired: true, toolUsageRequired: Boolean(n.source?.toolId || n.toolAttachments.length), wiredOnly: true }),
      agentRecommendations: n.team?.agents.map((a) => recommendModelForAgent({ nodeId: n.id, agentId: a.id, nodeType: n.type, role: a.role || n.role, structuredOutputRequired: true, toolUsageRequired: Boolean(a.toolAttachments.length), wiredOnly: true })) ?? [],
    })));
    put("models/model-router-notes.md", modelRouterNotesMd(p));

    json("datasets/datasets.json", datasets);
    json("datasets/dataset-schemas.json", datasets.map((d) => ({ id: d.id, name: d.name, mode: d.mode, rowCount: d.rows.length, qualityScore: d.qualityScore ?? null, scenarioTags: d.scenarioTags, requiredFields: d.requiredFields, schema: d.schema })));
    json("datasets/source-configs.json", p.nodes.filter((n) => n.source).map((n) => ({ nodeId: n.id, title: n.title, ...n.source })));
    json("datasets/scenario-sets.json", p.scenarioSets ?? []);

    json("contracts/data-contracts.json", p.edges.filter((e) => e.contract).map((e) => ({ id: e.id, fromNodeId: e.source, toNodeId: e.target, ...e.contract })));
    json("contracts/field-mappings.json", p.fieldMappings ?? []);
    json("contracts/contract-warnings.json", run?.packetWarnings ?? []);

    json("packets/handoff-packets.json", run?.packets ?? []);
    json("packets/packet-timeline.json", run?.packets ? packetTimeline(p, run.packets) : []);
    json("packets/field-drift-warnings.json", run?.packetWarnings ?? []);

    json("tables/output-tables.json", p.outputTables);
    json("tables/latest-output-tables.json", tables);

    json("ui/ui-bindings.json", p.uiBindings);
    json("ui/preview-config.json", p.uiBindings.map((b) => ({ id: b.id, componentType: b.componentType, title: b.title, tableId: b.tableId, fields: b.fields })));
    json("ui/preview-data.json", p.uiBindings.slice().sort((a, b) => a.position - b.position).map((b) => {
      const t = tables.find((x) => x.id === b.tableId);
      return { componentType: b.componentType, title: b.title, poweredBy: b.tableId, fields: b.fields, columns: t?.columns ?? [], sampleRows: t?.rows.slice(0, 5) ?? [] };
    }));

    json("runs/latest-run-trace.json", run?.runTrace ?? null);
    json("runs/team-runs.json", run?.teamRuns ?? []);
    json("runs/agent-runs.json", run?.agentRuns ?? []);
    json("runs/tool-traces.json", run?.toolTraces ?? run?.runTrace?.toolTraces ?? []);
    json("runs/cost-trace.json", run?.runTrace ? summarizeRunCost(run.runTrace) : { totalCostUsd: 0, totalLatencyMs: 0, warningCount: 0, modelsUsed: [] });

    json("takes/takes.json", takes);
    json("takes/take-comparison.json", takes.length ? compareTakes(takes) : { rows: [], dimensions: [] });

    const evalResults = run?.evalResults ?? run?.runTrace?.evalResults ?? [];
    json("evals/eval-scores.json", evalResults);
    json("evals/eval-summary.json", { count: evalResults.length, overall: evalResults.find((r) => r.nodeId === "__overall__")?.overall ?? null, byNode: evalResults.map((r) => ({ nodeId: r.nodeId, overall: r.overall, verdict: r.verdict })) });

    json("product/product-variations.json", p.productVariations ?? []);
    json("product/remix-proposals.json", p.remixProposals ?? []);
    put("product/product-brief.md", productBriefMd(brief));
  }

  // ── runtime package ──
  if (has("runtime") || developer) {
    put("runtime/flowmind-runtime.ts", FLOWMIND_RUNTIME_TS, "Portable, dependency-free runtime");
    put("runtime/run-pipeline.ts", RUN_PIPELINE_TS, "Runnable example: npm start");
    put("runtime/types.ts", RUNTIME_TYPES_TS);
    put("runtime/tool-adapters.ts", toolAdaptersTs(p), "Wire real tool/API calls here");
    put("runtime/model-adapters.ts", MODEL_ADAPTERS_TS, "Wire your model provider here");
    put("runtime/example-input.json", exampleInputJson(p));
    put("runtime/example-output.json", exampleOutputJson(p, tables, run?.finalOutput ?? null));
  }

  // ── docs ──
  if (has("client_blueprint")) put("docs/client-blueprint.md", clientBlueprintMd(docsCtx), "Agency / client-ready overview");
  if (has("founder_brief")) {
    put("docs/founder-brief.md", founderBriefMd(docsCtx), "Is it worth building?");
    put("docs/implementation-plan.md", implementationPlanMd(docsCtx), "Phased build plan");
  }
  if (has("api") || developer) put("docs/api-docs.md", apiDocsMd(docsCtx), "Hosted run endpoint docs");

  // ── manifest + health check (always last) ──
  const healthCheck = buildExportHealthCheck({ pipeline: p, datasets, hasRun: Boolean(run?.runTrace) });
  const manifest: ExportManifest = {
    exportId: newId("export"),
    pipelineId: p.id,
    pipelineName: drop.name,
    exportedAt: new Date().toISOString(),
    exportModes: modes,
    fileCount: files.length + 1,
    files: [...files, { path: "export-manifest.json", type: "json", description: "This manifest" }],
    healthCheck,
  };
  zip.file("export-manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, manifest, slug: slugify(drop.name) };
}

/** Build + download the export ZIP. Returns the manifest for history/persistence. */
export async function downloadExportBundle(ctx: ExportContext, modes: ExportMode[]): Promise<ExportManifest> {
  const { blob, manifest, slug } = await createExportBundle(ctx, modes);
  saveAs(blob, `${slug}-flowmind-export.zip`);
  return manifest;
}
