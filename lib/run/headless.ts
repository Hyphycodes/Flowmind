import { pipelineSchema, type Pipeline, type RunTrace } from "@/lib/pipeline/schema";
import { getServerSupabase } from "@/lib/supabase/server";
import { rowToTrigger } from "@/lib/supabase/queries";
import { newId } from "@/lib/pipeline/validate";
import { MAX_TRIGGER_CHAIN_DEPTH } from "@/lib/automation/schema";
import { runPipelineCore } from "./core";

/** Headless run (Task 06). Runs a saved pipeline to completion WITHOUT a browser tab — reusing the
 *  shared run engine (lib/run/core) — and persists the RunTrace. Called by the trigger worker, the
 *  webhook route, and pipeline→pipeline chains. Server-only (trusted Supabase client). */

export async function getPipelineServer(id: string): Promise<Pipeline | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("pipelines").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; name: string; description: string | null; graph: Record<string, unknown> | null };
  try {
    return pipelineSchema.parse({ id: row.id, name: row.name, description: row.description ?? "", ...(row.graph ?? {}), runHistory: [] });
  } catch {
    return null;
  }
}

async function saveRunServer(run: RunTrace): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  const base = {
    pipeline_id: run.pipelineId,
    status: run.status,
    trace: {
      steps: run.steps,
      packets: run.packets,
      packetWarnings: run.packetWarnings,
      agentRuns: run.agentRuns,
      teamRuns: run.teamRuns,
      toolTraces: run.toolTraces,
      modelBattles: run.modelBattles,
      costUsd: run.costUsd ?? null,
      latencyMs: run.latencyMs ?? null,
      source: run.source ?? null,
    },
    tables: run.tables,
    final_output: run.finalOutput ?? null,
    started_at: run.startedAt ?? null,
    finished_at: run.finishedAt ?? null,
  };
  const withSource = await sb.from("runs").insert({ ...base, source: run.source ?? null });
  if (withSource.error) await sb.from("runs").insert(base);
}

async function markTriggerFired(triggerId: string, runId: string, status: string): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb
    .from("triggers")
    .update({ last_fired_at: new Date().toISOString(), last_status: status === "success" ? "success" : "error" })
    .eq("id", triggerId);
  await sb
    .from("trigger_runs")
    .insert({ id: newId("trun"), trigger_id: triggerId, run_id: runId, status, created_at: new Date().toISOString() });
}

export type HeadlessOptions = {
  pipelineId: string;
  inputs?: Record<string, string>;
  source: RunTrace["source"];
  triggerId?: string;
  /** chain depth for pipeline→pipeline triggers (runaway protection) */
  depth?: number;
};

export async function runPipelineHeadless(opts: HeadlessOptions): Promise<RunTrace | null> {
  const pipeline = await getPipelineServer(opts.pipelineId);
  if (!pipeline) return null;
  const trace = await runPipelineCore(pipeline, { mode: "hybrid", inputs: opts.inputs, source: opts.source });
  await saveRunServer(trace);
  if (opts.triggerId) await markTriggerFired(opts.triggerId, trace.id, trace.status);
  if (trace.status === "success") await fireDownstream(opts.pipelineId, trace, opts.depth ?? 0);
  return trace;
}

/** After a pipeline completes successfully, fire downstream pipeline→pipeline triggers. Depth-capped
 *  and self-loop-guarded so A→B→A can never loop forever. */
async function fireDownstream(pipelineId: string, upstreamTrace: RunTrace, depth: number): Promise<void> {
  if (depth >= MAX_TRIGGER_CHAIN_DEPTH) return;
  const sb = getServerSupabase();
  if (!sb) return;
  const { data } = await sb
    .from("triggers")
    .select("*")
    .eq("type", "pipeline")
    .eq("upstream_pipeline_id", pipelineId)
    .eq("enabled", true);
  const triggers = ((data as Record<string, unknown>[]) ?? []).flatMap((r) => {
    const t = rowToTrigger(r);
    return t ? [t] : [];
  });
  for (const t of triggers) {
    if (t.pipelineId === pipelineId) continue; // direct self-loop guard
    const inputs = { ...flattenInputs(t.defaultInputs), ...upstreamToInputs(upstreamTrace) };
    await runPipelineHeadless({ pipelineId: t.pipelineId, inputs, source: "pipeline", triggerId: t.id, depth: depth + 1 });
  }
}

function upstreamToInputs(trace: RunTrace): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of trace.finalOutput?.highlights ?? []) {
    const key = h.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (key) out[key] = h.value;
  }
  return out;
}

function flattenInputs(d: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) out[k] = typeof v === "string" ? v : String(v ?? "");
  return out;
}
