import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { executeNode } from "@/lib/pipeline/executeNode";
import { topoOrder } from "@/lib/runtime/runPipeline";
import { newId } from "@/lib/pipeline/validate";
import type { FinalOutput, OutputTable, Pipeline, PipelineNode } from "@/lib/pipeline/schema";

/** A results-only run for a hosted Run-App. Executes the owner's pipeline server-side under their
 *  configuration and returns ONLY the final output + output tables — never per-node prompts, inputs,
 *  outputs, or traces. The requester's input values override the pipeline's mock inputs.
 *  (Task 06 will consolidate this with the interactive run engine into a shared headless core.) */

function inputTable(node: PipelineNode, fields: Pipeline["mockInputs"]): OutputTable | null {
  if (!fields.length) return null;
  const key = node.outputs[0] ?? "input";
  return {
    id: key,
    name: key,
    sourceNodeId: node.id,
    description: "Pipeline input",
    columns: fields.map((f) => ({ key: f.key, label: f.label, type: "text" as const })),
    rows: [Object.fromEntries(fields.map((f) => [f.key, f.value]))],
  };
}

function upstreamFor(node: PipelineNode, p: Pipeline, tables: Map<string, OutputTable>): Record<string, OutputTable> {
  const out: Record<string, OutputTable> = {};
  const keys = new Set<string>(node.inputs);
  for (const e of p.edges) {
    if (e.target !== node.id) continue;
    if (e.dataKey) keys.add(e.dataKey);
    p.nodes.find((n) => n.id === e.source)?.outputs.forEach((k) => keys.add(k));
  }
  for (const k of keys) {
    const t = tables.get(k);
    if (t) out[k] = t;
  }
  if (Object.keys(out).length === 0) for (const [k, t] of tables) out[k] = t;
  return out;
}

function downstreamFor(node: PipelineNode, p: Pipeline): string | undefined {
  return p.edges.find((e) => e.source === node.id)?.target;
}

function fieldKeysFor(tables: Record<string, OutputTable>): string[] {
  const keys = new Set<string>();
  for (const [tableKey, table] of Object.entries(tables)) {
    keys.add(tableKey);
    for (const col of table.columns) keys.add(col.key);
    for (const row of table.rows.slice(0, 3)) for (const key of Object.keys(row)) keys.add(key);
  }
  return [...keys];
}

function synthFinal(p: Pipeline, tables: Map<string, OutputTable>): FinalOutput {
  const last = [...tables.values()].pop();
  const highlights: FinalOutput["highlights"] = [];
  if (last?.rows[0]) {
    for (const c of last.columns.slice(0, 4)) highlights.push({ label: c.label, value: String(last.rows[0][c.key] ?? "") });
  }
  return { title: `${p.name} — Result`, summary: `${p.name} run complete.`, highlights };
}

export async function runSharedPipeline(
  pipeline: Pipeline,
  inputs: Record<string, string>,
): Promise<{ finalOutput: FinalOutput; tables: OutputTable[] }> {
  const mockInputs = pipeline.mockInputs.map((f) => ({ ...f, value: inputs[f.key] ?? f.value }));
  const mockMap = Object.fromEntries(mockInputs.map((f) => [f.key, f.value]));
  const tables = new Map<string, OutputTable>();
  const order = topoOrder(pipeline);
  const runId = newId("run");
  const modelAvailable = hasAnthropicKey();
  let finalOutput: FinalOutput | undefined;

  for (const nodeId of order) {
    const node = pipeline.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    if (node.type === "input") {
      const t = inputTable(node, mockInputs);
      if (t) tables.set(t.id, t);
      continue;
    }
    const upstream = upstreamFor(node, pipeline, tables);
    const res = await executeNode(node, {
      pipelineName: pipeline.name,
      mockInputs: mockMap,
      upstream,
      pipeline,
      runId,
      toNodeId: downstreamFor(node, pipeline),
      upstreamFieldKeys: fieldKeysFor(upstream),
      modelAvailable,
    });
    for (const t of res.tables) tables.set(t.id, t);
    if (res.final) finalOutput = res.final;
  }

  if (!finalOutput) finalOutput = synthFinal(pipeline, tables);
  return { finalOutput, tables: [...tables.values()] };
}
