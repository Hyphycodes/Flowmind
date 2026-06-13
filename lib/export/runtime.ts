import type { OutputTable, Pipeline } from "@/lib/pipeline/schema";
import { getTool } from "@/lib/tools/registry";

/** Source for the exported runtime/ files. These are credible, self-contained,
 *  dependency-free TypeScript templates (no backticks/`${}` inside so they embed
 *  cleanly). They mirror lib/runtime/* (the in-app portable SDK). */

export const FLOWMIND_RUNTIME_TS = `// flowmind-runtime.ts — portable, dependency-free Flowmind runtime (simulate mode).
// The small engine that lets a real app run a Flowmind pipeline. For live/hybrid
// execution, wire model-adapters.ts + tool-adapters.ts.

export type OutputTable = { id: string; name: string; sourceNodeId?: string; columns: { key: string; label: string; type?: string }[]; rows: Record<string, unknown>[] };
export type HandoffPacket = { packetId: string; fromNodeId: string; toNodeId?: string; summary: string; keyFields: Record<string, unknown>; confidence: number };
export type RunResult = { finalOutput: unknown; outputTables: OutputTable[]; handoffPackets: HandoffPacket[]; order: string[] };
export type RunOptions = { pipeline: any; input?: Record<string, unknown>; mode?: "simulate" | "live" | "hybrid" };

export function topoOrder(pipeline: any): string[] {
  const indeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const n of pipeline.nodes) { indeg[n.id] = 0; adj[n.id] = []; }
  for (const e of pipeline.edges) { if (adj[e.source]) adj[e.source].push(e.target); if (e.target in indeg) indeg[e.target]++; }
  const q = pipeline.nodes.filter((n: any) => indeg[n.id] === 0).map((n: any) => n.id);
  const order: string[] = []; const seen: Record<string, boolean> = {};
  while (q.length) { const u = q.shift(); if (seen[u]) continue; seen[u] = true; order.push(u); for (const v of adj[u] || []) { indeg[v]--; if (indeg[v] === 0) q.push(v); } }
  for (const n of pipeline.nodes) if (!seen[n.id]) order.push(n.id);
  return order;
}

function seedMap(pipeline: any): Record<string, OutputTable> {
  const m: Record<string, OutputTable> = {};
  for (const t of pipeline.outputTables || []) m[t.id] = t;
  return m;
}

export function resolveSource(node: any, input: Record<string, unknown>, seed: Record<string, OutputTable>): OutputTable[] {
  const keys = node.outputs && node.outputs.length ? node.outputs : [node.id];
  return keys.map((k: string) => seed[k] || { id: k, name: k, sourceNodeId: node.id, columns: Object.keys(input).map((kk) => ({ key: kk, label: kk })), rows: [input] });
}

export function executeSingleAgent(node: any, _upstream: OutputTable[], seed: Record<string, OutputTable>): OutputTable[] {
  const keys = node.outputs && node.outputs.length ? node.outputs : [node.id];
  return keys.map((k: string) => seed[k] || { id: k, name: k, sourceNodeId: node.id, columns: [{ key: "summary", label: "Summary" }], rows: [{ summary: node.title + " output (simulate)" }] });
}

export function createHandoffPacket(node: any, tables: OutputTable[]): HandoffPacket {
  return { packetId: "pkt_" + node.id, fromNodeId: node.id, summary: node.title + " handed off " + tables.map((t) => t.name).join(", "), keyFields: { tables: tables.map((t) => t.name), rowCounts: tables.map((t) => t.rows.length) }, confidence: 0.8 };
}

export function executeTeamNode(node: any, upstream: OutputTable[], seed: Record<string, OutputTable>): { tables: OutputTable[]; packet: HandoffPacket } {
  const tables = executeSingleAgent(node, upstream, seed);
  return { tables, packet: createHandoffPacket(node, tables) };
}

export function collectOutputTables(map: Record<string, OutputTable>): OutputTable[] {
  return Object.keys(map).map((k) => map[k]);
}

export async function runFlowmindPipeline(opts: RunOptions): Promise<RunResult> {
  const pipeline = opts.pipeline;
  const input = opts.input || {};
  const mode = opts.mode || "simulate";
  if (mode !== "simulate") {
    console.warn("[flowmind] " + mode + " mode falls back to simulate in this portable runtime; wire model-adapters.ts + tool-adapters.ts for live execution.");
  }
  const seed = seedMap(pipeline);
  const order = topoOrder(pipeline);
  const tablesById: Record<string, OutputTable> = {};
  const packets: HandoffPacket[] = [];
  for (const id of order) {
    const node = pipeline.nodes.find((n: any) => n.id === id);
    if (!node) continue;
    const upstream = collectOutputTables(tablesById);
    let produced: OutputTable[] = [];
    if (node.type === "input") {
      const key = (node.outputs || [])[0] || "input";
      produced = [{ id: key, name: key, sourceNodeId: node.id, columns: Object.keys(input).map((k) => ({ key: k, label: k })), rows: [input] }];
    } else if (node.source) {
      produced = resolveSource(node, input, seed);
    } else if (node.team) {
      const r = executeTeamNode(node, upstream, seed);
      produced = r.tables; packets.push(r.packet);
    } else {
      produced = executeSingleAgent(node, upstream, seed);
    }
    for (const t of produced) tablesById[t.id] = t;
  }
  const outputTables = collectOutputTables(tablesById);
  const last = pipeline.nodes.filter((n: any) => n.type === "output").pop() || pipeline.nodes[pipeline.nodes.length - 1];
  const lastTable = last ? tablesById[(last.outputs || [])[0]] : undefined;
  const firstRow = lastTable && lastTable.rows[0] ? lastTable.rows[0] : {};
  const finalOutput = { title: pipeline.name + " — Result", summary: "Ran " + order.length + " nodes, produced " + outputTables.length + " output table(s).", highlights: Object.keys(firstRow).slice(0, 4).map((k) => ({ label: k, value: String((firstRow as any)[k]) })) };
  return { finalOutput, outputTables, handoffPackets: packets, order };
}
`;

export const RUN_PIPELINE_TS = `// run-pipeline.ts — runnable example. From the export root: npx tsx runtime/run-pipeline.ts
import { runFlowmindPipeline } from "./flowmind-runtime";
import pipeline from "../pipeline/pipeline.json";
import input from "./example-input.json";

async function main() {
  const result = await runFlowmindPipeline({ pipeline: pipeline as any, input, mode: "simulate" });
  console.log("Final output:\\n", JSON.stringify(result.finalOutput, null, 2));
  console.log("\\nOutput tables:", result.outputTables.map((t) => t.name).join(", "));
  console.log("Handoff packets:", result.handoffPackets.length);
}

main().catch((err) => { console.error(err); process.exit(1); });
`;

export const RUNTIME_TYPES_TS = `// types.ts — shared runtime types.
export type { OutputTable, HandoffPacket, RunResult, RunOptions } from "./flowmind-runtime";
`;

export const MODEL_ADAPTERS_TS = `// model-adapters.ts — wire your model provider here (e.g. the Anthropic API).
// The portable runtime runs in simulate mode without a model; live/hybrid calls this.
export async function callModel(opts: { modelId: string; system?: string; prompt: string }): Promise<string> {
  // Example (Anthropic): use process.env.ANTHROPIC_API_KEY + @ai-sdk/anthropic.
  throw new Error("Implement callModel for " + opts.modelId + " using your provider key.");
}
`;

export function toolAdaptersTs(pipeline: Pipeline): string {
  const ids = Array.from(
    new Set(
      pipeline.nodes
        .flatMap((n) => [n.source?.toolId, ...n.toolAttachments.map((a) => a.toolId)])
        .filter(Boolean) as string[],
    ),
  );
  const cases = ids
    .map((id) => {
      const def = getTool(id);
      const env = def?.requiredEnv?.[0] ? " using " + def.requiredEnv[0] : "";
      return '    case "' + id + '": throw new Error("Implement ' + (def?.name ?? id) + ' adapter' + env + '");';
    })
    .join("\n");
  return [
    "// tool-adapters.ts — wire real tool/API calls here.",
    "// resolveSource() falls back to datasets/seeded tables when a tool isn't implemented.",
    "export async function callTool(toolId: string, _input: Record<string, unknown>): Promise<unknown> {",
    "  switch (toolId) {",
    cases || '    // (no tools attached to this pipeline)',
    '    default: throw new Error("No adapter for tool: " + toolId);',
    "  }",
    "}",
    "",
    "// Working example: read rows from an exported dataset (datasets/*.json).",
    "export function datasetLookup(datasetId: string, datasets: { id: string; rows: unknown[] }[]): unknown[] {",
    "  const d = datasets.find((x) => x.id === datasetId);",
    '  if (!d) throw new Error("Dataset not found: " + datasetId);',
    "  return d.rows;",
    "}",
    "",
  ].join("\n");
}

export function exampleInputJson(pipeline: Pipeline): string {
  const input = Object.fromEntries(pipeline.mockInputs.map((f) => [f.key, f.value]));
  return JSON.stringify(Object.keys(input).length ? input : { example: "your input here" }, null, 2);
}

export function exampleOutputJson(pipeline: Pipeline, tables: OutputTable[], finalOutput: unknown): string {
  return JSON.stringify(
    {
      finalOutput: finalOutput ?? { title: pipeline.name + " — Result", summary: "Example output", highlights: [] },
      outputTables: tables.map((t) => ({ name: t.name, rowCount: t.rows.length, sample: t.rows[0] ?? null })),
    },
    null,
    2,
  );
}

export function packageJson(pipeline: Pipeline, slug: string): string {
  return JSON.stringify(
    {
      name: slug,
      version: "0.1.0",
      private: true,
      description: (pipeline.blueprint?.pitch || pipeline.description || pipeline.name).slice(0, 140),
      type: "module",
      scripts: { start: "tsx runtime/run-pipeline.ts" },
      devDependencies: { tsx: "^4.7.0", typescript: "^5.4.0" },
    },
    null,
    2,
  );
}

export const TSCONFIG_JSON = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      esModuleInterop: true,
      strict: false,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["runtime/**/*.ts", "pipeline/**/*.json"],
  },
  null,
  2,
);
