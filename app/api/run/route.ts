import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { executeNode } from "@/lib/pipeline/executeNode";
import {
  pipelineSchema,
  outputTableSchema,
  EXECUTION_MODES,
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
import { newId } from "@/lib/pipeline/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

function topoOrder(p: Pipeline): string[] {
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

function upstreamFor(
  node: PipelineNode,
  p: Pipeline,
  tables: Map<string, OutputTable>,
): Record<string, OutputTable> {
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
    for (const row of table.rows.slice(0, 3)) {
      for (const key of Object.keys(row)) keys.add(key);
    }
  }
  return [...keys];
}

function synthFinal(p: Pipeline, tables: Map<string, OutputTable>): FinalOutput {
  const last = [...tables.values()].pop();
  const highlights: FinalOutput["highlights"] = [];
  if (last?.rows[0]) {
    for (const c of last.columns.slice(0, 4)) {
      highlights.push({ label: c.label, value: String(last.rows[0][c.key] ?? "") });
    }
  }
  return {
    title: `${p.name} — Result`,
    summary: `${p.name} run complete with ${tables.size} output table(s).`,
    highlights,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestBody =
    body && typeof body === "object"
      ? (body as {
          pipeline?: unknown;
          onlyNodeId?: unknown;
          onlyAgentId?: unknown;
          seedTables?: unknown;
          mode?: unknown;
        })
      : {};
  const parsed = pipelineSchema.safeParse(requestBody.pipeline);
  if (!parsed.success) {
    return Response.json({ error: "Invalid pipeline" }, { status: 400 });
  }
  const pipeline = parsed.data;
  const mode: ExecutionMode = (EXECUTION_MODES as readonly string[]).includes(requestBody.mode as string)
    ? (requestBody.mode as ExecutionMode)
    : "hybrid";
  // simulate = deterministic/dataset-backed; live + hybrid use the model when a key exists.
  const modelAvailable = mode === "simulate" ? false : hasAnthropicKey();
  const onlyNodeId = typeof requestBody.onlyNodeId === "string" ? requestBody.onlyNodeId : undefined;
  const onlyAgentId = typeof requestBody.onlyAgentId === "string" ? requestBody.onlyAgentId : undefined;
  const seedTables = Array.isArray(requestBody.seedTables)
    ? requestBody.seedTables.flatMap((t: unknown) => {
        const parsedTable = outputTableSchema.safeParse(t);
        return parsedTable.success ? [parsedTable.data] : [];
      })
    : [];
  const order = onlyNodeId ? [onlyNodeId] : topoOrder(pipeline);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RunEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const tables = new Map<string, OutputTable>();
      if (onlyNodeId) for (const table of seedTables) tables.set(table.id, table);
      const mockInputs = Object.fromEntries(pipeline.mockInputs.map((f) => [f.key, f.value]));
      let finalOutput: FinalOutput | undefined;
      const runId = newId("run");
      const startedAt = new Date().toISOString();
      const steps: RunStep[] = [];
      const packets: RunTrace["packets"] = [];
      const packetWarnings: PacketWarning[] = [];
      const agentRuns: AgentRunTrace[] = [];
      const teamRuns: TeamRunTrace[] = [];

      send({ kind: "run-start", runId, order });
      try {
        for (const nodeId of order) {
          const node = pipeline.nodes.find((n) => n.id === nodeId);
          if (!node) continue;
          send({ kind: "node-start", nodeId });
          const t0 = Date.now();
          try {
            if (node.type === "input") {
              const t = inputTable(node, pipeline.mockInputs);
              if (t) tables.set(t.id, t);
              const step: RunStep = {
                nodeId,
                title: node.title,
                status: "success",
                summary: `Loaded ${pipeline.mockInputs.length} input field(s).`,
                durationMs: Date.now() - t0,
                startedAt: new Date(t0).toISOString(),
              };
              steps.push(step);
              send({
                kind: "node-done",
                nodeId,
                status: "success",
                summary: step.summary,
                durationMs: step.durationMs,
                tables: [...tables.values()],
              });
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
              onlyAgentId,
              modelAvailable,
              emit: send,
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
            send({
              kind: "node-done",
              nodeId,
              status: "success",
              summary: res.summary,
              durationMs: step.durationMs,
              tables: [...tables.values()],
              packet: res.packet,
            });
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
            send({
              kind: "node-done",
              nodeId,
              status: "error",
              summary: (err as Error)?.message ?? "Node failed",
              durationMs: Date.now() - t0,
              tables: [...tables.values()],
            });
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
          latencyMs: Date.now() - Date.parse(startedAt),
          costUsd: teamRuns.reduce((sum, trace) => sum + (trace.costUsd ?? 0), 0),
        };
        send({ kind: "run-done", status: "success", finalOutput, runTrace });
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
          finalOutput,
          latencyMs: Date.now() - Date.parse(startedAt),
        };
        send({
          kind: "run-done",
          status: "error",
          error: (err as Error)?.message ?? "Run failed",
          runTrace,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
