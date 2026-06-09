import { pipelineSchema, runTraceSchema, type Pipeline, type RunTrace } from "@/lib/pipeline/schema";
import { getSupabase } from "./client";

export type PipelineSummary = {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  updatedAt: string;
};

export type RunSummary = {
  id: string;
  pipelineId: string | null;
  status: string;
  title: string;
  createdAt: string;
};

function graphOf(p: Pipeline) {
  return {
    nodes: p.nodes,
    edges: p.edges,
    mockInputs: p.mockInputs,
    outputTables: p.outputTables,
    uiBindings: p.uiBindings,
  };
}

function rowToPipeline(row: any): Pipeline {
  return pipelineSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    ...(row.graph ?? {}),
    runHistory: [],
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  });
}

export async function listPipelines(): Promise<PipelineSummary[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pipelines")
    .select("id,name,description,graph,updated_at")
    .eq("is_template", false)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    nodeCount: Array.isArray(r.graph?.nodes) ? r.graph.nodes.length : 0,
    updatedAt: r.updated_at,
  }));
}

export async function getPipeline(id: string): Promise<Pipeline | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("pipelines").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  try {
    return rowToPipeline(data);
  } catch {
    return null;
  }
}

export async function upsertPipeline(p: Pipeline): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pipelines").upsert(
    {
      id: p.id,
      name: p.name,
      description: p.description,
      graph: graphOf(p),
      is_template: false,
    },
    { onConflict: "id" },
  );
  return !error;
}

export async function deletePipeline(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pipelines").delete().eq("id", id);
  return !error;
}

export async function saveRun(run: RunTrace): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("runs").insert({
    pipeline_id: run.pipelineId,
    status: run.status,
    trace: run.steps,
    tables: run.tables,
    final_output: run.finalOutput ?? null,
    started_at: run.startedAt ?? null,
    finished_at: run.finishedAt ?? null,
  });
  return !error;
}

export async function getLatestRun(pipelineId: string): Promise<RunTrace | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("runs")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return runTraceSchema.parse({
      id: data.id,
      pipelineId: data.pipeline_id,
      status: data.status,
      startedAt: data.started_at ?? undefined,
      finishedAt: data.finished_at ?? undefined,
      steps: data.trace ?? [],
      tables: data.tables ?? [],
      finalOutput: data.final_output ?? undefined,
    });
  } catch {
    return null;
  }
}

export async function listRuns(limit = 40): Promise<RunSummary[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("runs")
    .select("id,pipeline_id,status,final_output,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    pipelineId: r.pipeline_id,
    status: r.status,
    title: r.final_output?.title ?? "Run",
    createdAt: r.created_at,
  }));
}
