import {
  pipelineSchema,
  runTraceSchema,
  takeSchema,
  type Pipeline,
  type RunTrace,
  type Take,
} from "@/lib/pipeline/schema";
import { datasetSchema, type Dataset } from "@/lib/datasets/schema";
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
    datasetIds: p.datasetIds,
    fieldMappings: p.fieldMappings,
    scenarioSets: p.scenarioSets,
    version: p.version,
    blueprint: p.blueprint,
    realityMeter: p.realityMeter,
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
    trace: {
      steps: run.steps,
      packets: run.packets,
      packetWarnings: run.packetWarnings,
      agentRuns: run.agentRuns,
      teamRuns: run.teamRuns,
      takeId: run.takeId ?? null,
      costUsd: run.costUsd ?? null,
      latencyMs: run.latencyMs ?? null,
    },
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
    const trace = data.trace;
    const steps = Array.isArray(trace) ? trace : trace?.steps ?? [];
    return runTraceSchema.parse({
      id: data.id,
      pipelineId: data.pipeline_id,
      status: data.status,
      startedAt: data.started_at ?? undefined,
      finishedAt: data.finished_at ?? undefined,
      steps,
      tables: data.tables ?? [],
      finalOutput: data.final_output ?? undefined,
      packets: Array.isArray(trace) ? [] : trace?.packets ?? [],
      packetWarnings: Array.isArray(trace) ? [] : trace?.packetWarnings ?? [],
      agentRuns: Array.isArray(trace) ? [] : trace?.agentRuns ?? [],
      teamRuns: Array.isArray(trace) ? [] : trace?.teamRuns ?? [],
      takeId: Array.isArray(trace) ? undefined : trace?.takeId ?? undefined,
      costUsd: Array.isArray(trace) ? undefined : trace?.costUsd ?? undefined,
      latencyMs: Array.isArray(trace) ? undefined : trace?.latencyMs ?? undefined,
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

/* ── Datasets (Input Studio / Dataset Library) ───────────────────────── */

export async function listDatasets(): Promise<Dataset[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("datasets")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.flatMap((r: any) => {
    try {
      const meta = r.meta ?? {};
      return [
        datasetSchema.parse({
          id: r.id,
          name: r.name,
          description: r.description ?? "",
          mode: r.mode ?? "input_studio",
          schema: r.schema ?? [],
          rows: r.rows ?? [],
          sourcePrompt: r.source_prompt ?? undefined,
          version: r.version ?? 1,
          qualityScore: r.quality_score ?? undefined,
          qualityTarget: meta.qualityTarget ?? undefined,
          generationStyle: meta.generationStyle ?? undefined,
          scenarioTags: meta.scenarioTags ?? [],
          requiredFields: meta.requiredFields ?? [],
          connectedNodeId: meta.connectedNodeId ?? undefined,
          connectedPipelines: r.connected_pipelines ?? [],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }),
      ];
    } catch {
      return [];
    }
  });
}

export async function saveDataset(d: Dataset): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const base = {
    id: d.id,
    name: d.name,
    description: d.description,
    mode: d.mode,
    schema: d.schema,
    rows: d.rows,
    source_prompt: d.sourcePrompt ?? null,
    version: d.version,
    quality_score: d.qualityScore ?? null,
    connected_pipelines: d.connectedPipelines,
  };
  const meta = {
    qualityTarget: d.qualityTarget ?? null,
    generationStyle: d.generationStyle ?? null,
    scenarioTags: d.scenarioTags,
    requiredFields: d.requiredFields,
    connectedNodeId: d.connectedNodeId ?? null,
  };
  // Try with the meta column (migration 0003); fall back if it isn't applied yet.
  const withMeta = await sb.from("datasets").upsert({ ...base, meta }, { onConflict: "id" });
  if (!withMeta.error) return true;
  const { error } = await sb.from("datasets").upsert(base, { onConflict: "id" });
  return !error;
}

export async function deleteDataset(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("datasets").delete().eq("id", id);
  return !error;
}

/* ── Takes (saved run variations) ────────────────────────────────────── */

export async function saveTake(t: Take): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("takes").insert({
    pipeline_id: t.pipelineId,
    name: t.name,
    trace: t.trace ?? null,
    model_selections: t.modelSelections,
    scores: t.scores,
    cost_usd: t.costUsd ?? null,
    latency_ms: t.latencyMs ?? null,
    notes: t.notes,
  });
  return !error;
}

export async function listTakes(pipelineId?: string): Promise<Take[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from("takes").select("*").order("created_at", { ascending: false }).limit(60);
  if (pipelineId) q = q.eq("pipeline_id", pipelineId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.flatMap((r: any) => {
    try {
      return [
        takeSchema.parse({
          id: r.id,
          pipelineId: r.pipeline_id,
          name: r.name,
          trace: r.trace ?? undefined,
          modelSelections: r.model_selections ?? {},
          scores: r.scores ?? {},
          costUsd: r.cost_usd ?? undefined,
          latencyMs: r.latency_ms ?? undefined,
          notes: r.notes ?? "",
          createdAt: r.created_at,
        }),
      ];
    } catch {
      return [];
    }
  });
}
