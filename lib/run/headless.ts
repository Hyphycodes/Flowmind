import { pipelineSchema, type Pipeline, type RunTrace } from "@/lib/pipeline/schema";
import { getServerSupabase } from "@/lib/supabase/server";
import { runPipelineCore } from "./core";

/** Headless run (Task 06). Runs a saved pipeline to completion WITHOUT a browser tab — reusing the
 *  shared run engine (lib/run/core) — and persists the RunTrace. The pure runner; trigger
 *  observability (history, retry, alerts, downstream) lives in lib/automation/fire.ts. Server-only. */

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

export async function saveRunServer(run: RunTrace): Promise<void> {
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

export type HeadlessOptions = {
  pipelineId: string;
  inputs?: Record<string, string>;
  source: RunTrace["source"];
};

export async function runPipelineHeadless(opts: HeadlessOptions): Promise<RunTrace | null> {
  const pipeline = await getPipelineServer(opts.pipelineId);
  if (!pipeline) return null;
  const trace = await runPipelineCore(pipeline, { mode: "hybrid", inputs: opts.inputs, source: opts.source });
  await saveRunServer(trace);
  return trace;
}
