import type { HandoffPacket, OutputTable, Pipeline } from "@/lib/pipeline/schema";
import { resolveSource } from "./resolveSource";
import { executeSingleAgent, executeTeamNode } from "./executeTeam";
import type { RuntimeRunOptions, RuntimeRunResult } from "./types";

export function topoOrder(pipeline: Pipeline): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of pipeline.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of pipeline.edges) {
    if (!adj.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const q = pipeline.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  const seen = new Set<string>();
  while (q.length) {
    const u = q.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 1) - 1);
      if ((indeg.get(v) ?? 0) === 0) q.push(v);
    }
  }
  for (const n of pipeline.nodes) if (!seen.has(n.id)) order.push(n.id);
  return order;
}

export function collectOutputTables(map: Map<string, OutputTable>): OutputTable[] {
  return [...map.values()];
}

function downstreamFor(pipeline: Pipeline, nodeId: string): string | undefined {
  return pipeline.edges.find((e) => e.source === nodeId)?.target;
}

/** Run a pipeline portably (deterministic / simulate). The same engine the exported
 *  runtime mirrors. Live/hybrid model + tool calls require wiring adapters. */
export async function runPipelineRuntime(opts: RuntimeRunOptions): Promise<RuntimeRunResult> {
  const { pipeline, input = {}, mode = "simulate", datasets = [] } = opts;
  const warnings: string[] = [];
  if (mode !== "simulate") {
    warnings.push(`${mode} mode runs deterministically in the portable runtime; wire model/tool adapters for live execution.`);
  }

  const seed = new Map<string, OutputTable>(pipeline.outputTables.map((t) => [t.id, t]));
  const order = topoOrder(pipeline);
  const tablesById = new Map<string, OutputTable>();
  const packets: HandoffPacket[] = [];

  for (const id of order) {
    const node = pipeline.nodes.find((n) => n.id === id);
    if (!node) continue;
    const upstream = collectOutputTables(tablesById);
    let produced: OutputTable[] = [];
    if (node.type === "input") {
      const key = node.outputs[0] ?? "input";
      produced = [{ id: key, name: key, sourceNodeId: node.id, description: "Pipeline input", columns: Object.keys(input).map((k) => ({ key: k, label: k, type: "text" as const })), rows: [input] }];
    } else if (node.source) {
      produced = resolveSource(node, input, seed, datasets);
    } else if (node.team) {
      const r = executeTeamNode(node, upstream, seed, downstreamFor(pipeline, node.id));
      produced = r.tables;
      packets.push(r.packet);
    } else {
      produced = executeSingleAgent(node, upstream, seed);
    }
    for (const t of produced) tablesById.set(t.id, t);
  }

  const outputTables = collectOutputTables(tablesById);
  const lastOutputNode = [...pipeline.nodes].reverse().find((n) => n.type === "output") ?? pipeline.nodes[pipeline.nodes.length - 1];
  const lastTable = lastOutputNode ? tablesById.get(lastOutputNode.outputs[0] ?? "") : undefined;
  const firstRow = (lastTable?.rows[0] ?? {}) as Record<string, unknown>;
  const finalOutput = {
    title: `${pipeline.name} — Result`,
    summary: `Ran ${order.length} nodes, produced ${outputTables.length} output table(s).`,
    highlights: Object.keys(firstRow).slice(0, 4).map((k) => ({ label: k, value: String(firstRow[k]) })),
  };

  return { finalOutput, outputTables, handoffPackets: packets, order, warnings };
}
