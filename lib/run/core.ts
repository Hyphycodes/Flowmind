import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { executeNode } from "@/lib/pipeline/executeNode";
import { newId } from "@/lib/pipeline/validate";
import { descendantsOf } from "@/lib/pipeline/graph";
import {
  type AgentRunTrace,
  type ExecutionMode,
  type FinalOutput,
  type OutputTable,
  type PacketWarning,
  type Pipeline,
  type PipelineNode,
  type RunEvent,
  type RunStep,
  type RunTrace,
  type TeamRunTrace,
} from "@/lib/pipeline/schema";

/** The single run engine (Task 06). Extracted from the interactive route so the streaming POST
 *  /api/run, the hosted Run-App, and the headless trigger worker all share ONE execution core —
 *  no second engine. `emit` streams RunEvents when present (interactive); omit it for headless.
 *  Never throws — returns a RunTrace (success or error). */

export function topoOrder(p: Pipeline): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of p.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of p.edges) {
    if (!adj.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const q: string[] = [];
  for (const n of p.nodes) if ((indeg.get(n.id) ?? 0) === 0) q.push(n.id);
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
  for (const n of p.nodes) if (!seen.has(n.id)) order.push(n.id);
  return order;
}

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
  return { title: `${p.name} — Result`, summary: `${p.name} run complete with ${tables.size} output table(s).`, highlights };
}

export type RunCoreOptions = {
  mode?: ExecutionMode;
  onlyNodeId?: string;
  onlyAgentId?: string;
  fromNodeId?: string;
  seedTables?: OutputTable[];
  /** override the pipeline's mock input values (headless / triggers) */
  inputs?: Record<string, string>;
  modelAvailable?: boolean;
  /** how this run started — tagged onto the trace */
  source?: RunTrace["source"];
  /** stream RunEvents (interactive route); omit for headless */
  emit?: (e: RunEvent) => void;
};

export async function runPipelineCore(pipeline: Pipeline, opts: RunCoreOptions = {}): Promise<RunTrace> {
  const mode: ExecutionMode = opts.mode ?? "hybrid";
  const modelAvailable = opts.modelAvailable ?? (mode === "simulate" ? false : hasAnthropicKey());
  const scoped = Boolean(opts.onlyNodeId || opts.fromNodeId);
  const emit = opts.emit ?? (() => {});

  const order = opts.onlyNodeId
    ? [opts.onlyNodeId]
    : opts.fromNodeId
      ? (() => {
          const desc = descendantsOf(pipeline, opts.fromNodeId!);
          return topoOrder(pipeline).filter((id) => desc.has(id));
        })()
      : topoOrder(pipeline);

  // Apply input overrides (triggers/Run-App supply values).
  const effectiveInputs = pipeline.mockInputs.map((f) => ({ ...f, value: opts.inputs?.[f.key] ?? f.value }));
  const mockInputs = Object.fromEntries(effectiveInputs.map((f) => [f.key, f.value]));

  const tables = new Map<string, OutputTable>();
  if (scoped) for (const t of opts.seedTables ?? []) tables.set(t.id, t);

  const runId = newId("run");
  const startedAt = new Date().toISOString();
  const steps: RunStep[] = [];
  const packets: RunTrace["packets"] = [];
  const packetWarnings: PacketWarning[] = [];
  const agentRuns: AgentRunTrace[] = [];
  const teamRuns: TeamRunTrace[] = [];
  let finalOutput: FinalOutput | undefined;

  emit({ kind: "run-start", runId, order });
  try {
    for (const nodeId of order) {
      const node = pipeline.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      emit({ kind: "node-start", nodeId });
      const t0 = Date.now();
      try {
        if (node.type === "input") {
          const t = inputTable(node, effectiveInputs);
          if (t) tables.set(t.id, t);
          const step: RunStep = {
            nodeId,
            title: node.title,
            status: "success",
            summary: `Loaded ${effectiveInputs.length} input field(s).`,
            durationMs: Date.now() - t0,
            startedAt: new Date(t0).toISOString(),
          };
          steps.push(step);
          emit({ kind: "node-done", nodeId, status: "success", summary: step.summary, durationMs: step.durationMs, tables: [...tables.values()] });
          continue;
        }
        const upstream = upstreamFor(node, pipeline, tables);
        const res = await executeNode(node, {
          pipelineName: pipeline.name,
          mockInputs,
          upstream,
          pipeline,
          runId,
          toNodeId: downstreamFor(node, pipeline),
          upstreamFieldKeys: fieldKeysFor(upstream),
          onlyAgentId: opts.onlyAgentId,
          modelAvailable,
          emit,
        });
        for (const t of res.tables) tables.set(t.id, t);
        if (res.final) finalOutput = res.final;
        if (res.packet) packets.push(res.packet);
        if (res.packetWarnings?.length) packetWarnings.push(...res.packetWarnings);
        if (res.agentTraces?.length) agentRuns.push(...res.agentTraces);
        if (res.teamTrace) teamRuns.push(res.teamTrace);
        const step: RunStep = {
          nodeId,
          title: node.title,
          status: "success",
          input: upstream,
          output: res.teamTrace?.finalOutput ?? res.tables,
          summary: res.summary,
          durationMs: Date.now() - t0,
          startedAt: new Date(t0).toISOString(),
          kind: node.team ? "team" : "node",
          model: node.model,
          confidence: res.teamTrace?.confidence,
          costUsd: res.teamTrace?.costUsd,
          packetId: res.packet?.packetId,
        };
        steps.push(step);
        emit({ kind: "node-done", nodeId, status: "success", summary: res.summary, durationMs: step.durationMs, tables: [...tables.values()], packet: res.packet });
      } catch (err) {
        steps.push({
          nodeId,
          title: node.title,
          status: "error",
          input: upstreamFor(node, pipeline, tables),
          summary: (err as Error)?.message ?? "Node failed",
          durationMs: Date.now() - t0,
          startedAt: new Date(t0).toISOString(),
          kind: node.team ? "team" : "node",
          model: node.model,
        });
        emit({ kind: "node-done", nodeId, status: "error", summary: (err as Error)?.message ?? "Node failed", durationMs: Date.now() - t0, tables: [...tables.values()] });
        throw err;
      }
    }
    if (!finalOutput) finalOutput = synthFinal(pipeline, tables);
    const runTrace: RunTrace = {
      id: runId,
      pipelineId: pipeline.id,
      status: "success",
      startedAt,
      finishedAt: new Date().toISOString(),
      steps,
      tables: [...tables.values()],
      finalOutput,
      packets,
      packetWarnings,
      agentRuns,
      teamRuns,
      toolTraces: [],
      modelBattles: [],
      evalResults: [],
      mode,
      source: opts.source,
      latencyMs: Date.now() - Date.parse(startedAt),
      costUsd: teamRuns.reduce((sum, trace) => sum + (trace.costUsd ?? 0), 0),
    };
    emit({ kind: "run-done", status: "success", finalOutput, runTrace });
    return runTrace;
  } catch (err) {
    const runTrace: RunTrace = {
      id: runId,
      pipelineId: pipeline.id,
      status: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      steps,
      tables: [...tables.values()],
      packets,
      packetWarnings,
      agentRuns,
      teamRuns,
      toolTraces: [],
      modelBattles: [],
      evalResults: [],
      mode,
      source: opts.source,
      finalOutput,
      latencyMs: Date.now() - Date.parse(startedAt),
    };
    emit({ kind: "run-done", status: "error", error: (err as Error)?.message ?? "Run failed", runTrace });
    return runTrace;
  }
}
