import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { executeNode } from "@/lib/pipeline/executeNode";
import {
  pipelineSchema,
  type FinalOutput,
  type OutputTable,
  type Pipeline,
  type PipelineNode,
  type RunEvent,
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
  const parsed = pipelineSchema.safeParse((body as any)?.pipeline);
  if (!parsed.success) {
    return Response.json({ error: "Invalid pipeline" }, { status: 400 });
  }
  if (!hasAnthropicKey()) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local (and your Vercel project) to run pipelines with real Claude.",
      },
      { status: 400 },
    );
  }

  const pipeline = parsed.data;
  const order = topoOrder(pipeline);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RunEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const tables = new Map<string, OutputTable>();
      const mockInputs = Object.fromEntries(pipeline.mockInputs.map((f) => [f.key, f.value]));
      let finalOutput: FinalOutput | undefined;

      send({ kind: "run-start", runId: newId("run"), order });
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
              send({
                kind: "node-done",
                nodeId,
                status: "success",
                summary: `Loaded ${pipeline.mockInputs.length} input field(s).`,
                durationMs: Date.now() - t0,
                tables: [...tables.values()],
              });
              continue;
            }
            const res = await executeNode(node, {
              pipelineName: pipeline.name,
              mockInputs,
              upstream: upstreamFor(node, pipeline, tables),
            });
            for (const t of res.tables) tables.set(t.id, t);
            if (res.final) finalOutput = res.final;
            send({
              kind: "node-done",
              nodeId,
              status: "success",
              summary: res.summary,
              durationMs: Date.now() - t0,
              tables: [...tables.values()],
            });
          } catch (err) {
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
        send({ kind: "run-done", status: "success", finalOutput });
      } catch (err) {
        send({ kind: "run-done", status: "error", error: (err as Error)?.message ?? "Run failed" });
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
