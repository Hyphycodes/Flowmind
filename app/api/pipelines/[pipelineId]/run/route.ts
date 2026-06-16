import { pipelineSchema, type Pipeline } from "@/lib/pipeline/schema";
import { datasetSchema, type Dataset } from "@/lib/datasets/schema";
import { getPipeline } from "@/lib/supabase/queries";
import { runPipelineRuntime } from "@/lib/runtime";
import { newId } from "@/lib/pipeline/validate";
import { safeApiError, requireAuthedAI } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Hosted run endpoint for an exported pipeline.
 *  POST /api/pipelines/[pipelineId]/run  → final output + tables + packets + trace summary.
 *  Uses the portable runtime (deterministic / simulate-safe). No secrets are read or returned.
 *  `simulate` (the default) is deterministic and token-free, so it stays open; `live`/`hybrid`
 *  spend provider tokens and therefore require auth + per-user rate limiting. */
export async function POST(req: Request, { params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body is allowed */
  }

  // Pipeline: explicit body.pipeline (portable/no-DB) or loaded by id from Supabase.
  let pipeline: Pipeline | null = null;
  if (body.pipeline) {
    const parsed = pipelineSchema.safeParse(body.pipeline);
    if (!parsed.success) return Response.json({ error: "Invalid pipeline in request body." }, { status: 400 });
    pipeline = parsed.data;
  } else {
    pipeline = await getPipeline(pipelineId);
  }
  if (!pipeline) {
    return Response.json(
      { error: `Pipeline "${pipelineId}" not found. Pass it in the request body as { pipeline } to run without a database.` },
      { status: 404 },
    );
  }

  const mode = body.mode === "live" || body.mode === "hybrid" ? body.mode : "simulate";
  // Token-spending modes require auth + rate limiting; simulate stays open (deterministic, no provider call).
  if (mode !== "simulate") {
    const guard = await requireAuthedAI();
    if (guard instanceof Response) return guard;
  }
  const input = body.input && typeof body.input === "object" ? (body.input as Record<string, unknown>) : Object.fromEntries(pipeline.mockInputs.map((f) => [f.key, f.value]));
  const datasets: Dataset[] = Array.isArray(body.datasets)
    ? body.datasets.flatMap((d) => {
        const r = datasetSchema.safeParse(d);
        return r.success ? [r.data] : [];
      })
    : [];

  try {
    const result = await runPipelineRuntime({ pipeline, input, mode, datasets });
    return Response.json({
      runId: newId("run"),
      takeId: newId("take"),
      status: "success",
      mode,
      finalOutput: result.finalOutput,
      outputTables: result.outputTables.map((t) => ({ id: t.id, name: t.name, rowCount: t.rows.length, rows: t.rows })),
      handoffPackets: result.handoffPackets,
      traceSummary: { nodes: result.order.length, tables: result.outputTables.length, packets: result.handoffPackets.length },
      warnings: result.warnings,
    });
  } catch (err) {
    return Response.json({ status: "error", error: safeApiError(err, "Run failed") }, { status: 500 });
  }
}
