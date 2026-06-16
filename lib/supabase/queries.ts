import {
  pipelineSchema,
  runTraceSchema,
  takeSchema,
  type Pipeline,
  type RunTrace,
  type Take,
} from "@/lib/pipeline/schema";
import { datasetSchema, type Dataset } from "@/lib/datasets/schema";
import { builderPreferencesSchema, PREFERENCES_ID, type BuilderPreferences } from "@/lib/preferences/schema";
import type { ExportManifest } from "@/lib/export/schema";
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

type JsonRecord = Record<string, unknown>;

type PipelineRow = {
  id: string;
  name: string;
  description: string | null;
  graph: JsonRecord | null;
  created_at: string | null;
  updated_at: string | null;
};

type RunRow = {
  id: string;
  pipeline_id: string | null;
  status: string;
  final_output?: JsonRecord | null;
  trace?: JsonRecord | unknown[] | null;
  tables?: unknown[] | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
};

type DatasetRow = {
  id: string;
  name: string;
  description: string | null;
  mode: string | null;
  schema: unknown[] | null;
  rows: unknown[] | null;
  source_prompt: string | null;
  version: number | null;
  quality_score: number | null;
  connected_pipelines: string[] | null;
  meta: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

type TakeRow = {
  id: string;
  pipeline_id: string;
  name: string;
  description?: string | null;
  mode?: string | null;
  status?: string | null;
  run_trace_id?: string | null;
  trace: unknown;
  model_selections: JsonRecord | null;
  scores: JsonRecord | null;
  eval_results?: unknown[] | null;
  overall_score?: number | null;
  warning_count?: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  notes: string | null;
  created_at: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: JsonRecord | null | undefined, key: string, fallback: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
}

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
    defaultModelSelection: p.defaultModelSelection,
    toolAttachments: p.toolAttachments,
    modelBattles: p.modelBattles,
    version: p.version,
    blueprint: p.blueprint,
    realityMeter: p.realityMeter,
    productBrief: p.productBrief,
    productVariations: p.productVariations,
    remixProposals: p.remixProposals,
  } satisfies JsonRecord;
}

function rowToPipeline(row: PipelineRow): Pipeline {
  const graph = isRecord(row.graph) ? row.graph : {};
  return pipelineSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    ...graph,
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
  return (data as PipelineRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    nodeCount: Array.isArray(r.graph?.nodes) ? r.graph.nodes.length : 0,
    updatedAt: r.updated_at ?? new Date().toISOString(),
  }));
}

export async function getPipeline(id: string): Promise<Pipeline | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("pipelines").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  try {
    return rowToPipeline(data as PipelineRow);
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
      toolTraces: run.toolTraces,
      modelBattles: run.modelBattles,
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
    const run = data as RunRow;
    const trace = run.trace;
    const steps = Array.isArray(trace) ? trace : trace?.steps ?? [];
    return runTraceSchema.parse({
      id: run.id,
      pipelineId: run.pipeline_id,
      status: run.status,
      startedAt: run.started_at ?? undefined,
      finishedAt: run.finished_at ?? undefined,
      steps,
      tables: run.tables ?? [],
      finalOutput: run.final_output ?? undefined,
      packets: Array.isArray(trace) ? [] : trace?.packets ?? [],
      packetWarnings: Array.isArray(trace) ? [] : trace?.packetWarnings ?? [],
      agentRuns: Array.isArray(trace) ? [] : trace?.agentRuns ?? [],
      teamRuns: Array.isArray(trace) ? [] : trace?.teamRuns ?? [],
      toolTraces: Array.isArray(trace) ? [] : trace?.toolTraces ?? [],
      modelBattles: Array.isArray(trace) ? [] : trace?.modelBattles ?? [],
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
  return (data as RunRow[]).map((r) => ({
    id: r.id,
    pipelineId: r.pipeline_id,
    status: r.status,
    title: stringField(r.final_output, "title", "Run"),
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
  return (data as DatasetRow[]).flatMap((r) => {
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
  const base = {
    pipeline_id: t.pipelineId,
    name: t.name,
    trace: t.trace ?? null,
    model_selections: t.modelSelections,
    scores: t.scores,
    cost_usd: t.costUsd ?? null,
    latency_ms: t.latencyMs ?? null,
    notes: t.notes,
  };
  const extra = {
    description: t.description,
    mode: t.mode ?? null,
    status: t.status,
    run_trace_id: t.runTraceId ?? null,
    eval_results: t.evalResults,
    overall_score: t.overallScore ?? null,
    warning_count: t.warningCount ?? null,
  };
  // Try with the Prompt-05 columns (migration 0005); fall back if not applied yet.
  const rich = await sb.from("takes").insert({ ...base, ...extra });
  if (!rich.error) return true;
  const { error } = await sb.from("takes").insert(base);
  return !error;
}

/* ── Builder preferences (the copilot that remembers) ────────────────── */

export async function getBuilderPreferences(): Promise<BuilderPreferences | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("builder_preferences").select("*").eq("id", PREFERENCES_ID).maybeSingle();
  if (error || !data) return null;
  try {
    const row = data as { id: string; scope?: string; patterns?: unknown; defaults?: unknown; updated_at?: string };
    return builderPreferencesSchema.parse({
      id: row.id,
      scope: row.scope ?? "user",
      patterns: row.patterns ?? [],
      defaults: row.defaults ?? {},
      updatedAt: row.updated_at ?? new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function saveBuilderPreferences(p: BuilderPreferences): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("builder_preferences").upsert(
    { id: p.id, scope: p.scope, patterns: p.patterns, defaults: p.defaults, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  return !error;
}

/* ── Export history (manifest only, not the ZIP) ─────────────────────── */

export async function saveExport(manifest: ExportManifest): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("exports").insert({
    pipeline_id: manifest.pipelineId,
    mode: manifest.exportModes,
    manifest,
    health_check: manifest.healthCheck,
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
  return (data as TakeRow[]).flatMap((r) => {
    try {
      return [
        takeSchema.parse({
          id: r.id,
          pipelineId: r.pipeline_id,
          name: r.name,
          description: r.description ?? "",
          mode: r.mode ?? undefined,
          status: r.status ?? "success",
          runTraceId: r.run_trace_id ?? undefined,
          trace: r.trace ?? undefined,
          modelSelections: r.model_selections ?? {},
          scores: r.scores ?? {},
          evalResults: r.eval_results ?? [],
          overallScore: r.overall_score ?? undefined,
          warningCount: r.warning_count ?? undefined,
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
