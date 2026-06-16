import {
  pipelineSchema,
  outputTableSchema,
  EXECUTION_MODES,
  type ExecutionMode,
  type RunEvent,
} from "@/lib/pipeline/schema";
import { runPipelineCore } from "@/lib/run/core";
import { getBillingAccount, recordRunSpend } from "@/lib/billing/usage";
import { estimateCreditsForRun } from "@/lib/billing/credits";
import { canRunPipeline } from "@/lib/billing/featureGates";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Interactive run: parse + billing-gate + stream the shared run engine (lib/run/core). The same
 *  core powers the hosted Run-App and the headless trigger worker — one engine, not three. */
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
          fromNodeId?: unknown;
          seedTables?: unknown;
          mode?: unknown;
        })
      : {};
  const parsed = pipelineSchema.safeParse(requestBody.pipeline);
  if (!parsed.success) return Response.json({ error: "Invalid pipeline" }, { status: 400 });
  const pipeline = parsed.data;

  const mode: ExecutionMode = (EXECUTION_MODES as readonly string[]).includes(requestBody.mode as string)
    ? (requestBody.mode as ExecutionMode)
    : "hybrid";
  const onlyNodeId = typeof requestBody.onlyNodeId === "string" ? requestBody.onlyNodeId : undefined;
  const onlyAgentId = typeof requestBody.onlyAgentId === "string" ? requestBody.onlyAgentId : undefined;
  const fromNodeId =
    typeof requestBody.fromNodeId === "string" && pipeline.nodes.some((n) => n.id === requestBody.fromNodeId)
      ? requestBody.fromNodeId
      : undefined;
  // Scoped runs (single node, single agent, replay) are cheap re-runs: no full billing gate, no spend.
  const scoped = Boolean(onlyNodeId || fromNodeId);
  const seedTables = Array.isArray(requestBody.seedTables)
    ? requestBody.seedTables.flatMap((t: unknown) => {
        const parsedTable = outputTableSchema.safeParse(t);
        return parsedTable.success ? [parsedTable.data] : [];
      })
    : [];

  // ── Billing gate (full runs only). No-op unless NEXT_PUBLIC_BILLING_ENABLED=true. ──
  const runEstimate = estimateCreditsForRun(pipeline, { onlyNodeId });
  if (!scoped) {
    const account = await getBillingAccount();
    const gate = canRunPipeline(account, runEstimate);
    if (!gate.allowed) {
      return Response.json({ error: gate.reason ?? "Out of credits", gate, estimate: runEstimate }, { status: 402 });
    }
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RunEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const trace = await runPipelineCore(pipeline, {
        mode,
        onlyNodeId,
        onlyAgentId,
        fromNodeId,
        seedTables,
        source: "manual",
        emit: send,
      });
      // Record credit spend (best-effort; no-op unless billing enabled + a full, successful run).
      if (!scoped && trace.status === "success") {
        void recordRunSpend({
          credits: runEstimate.credits,
          pipelineId: pipeline.id,
          runId: trace.id,
          modelCostEstimate: { usd: trace.costUsd },
        });
      }
      controller.close();
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
