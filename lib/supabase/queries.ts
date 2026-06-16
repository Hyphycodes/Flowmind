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
import { libraryAssetSchema, type LibraryAsset } from "@/lib/library/schema";
import { pipelineShareSchema, shareRunSchema, type PipelineShare, type ShareRun } from "@/lib/sharing/schema";
import { triggerSchema, triggerRunSchema, type Trigger, type TriggerRun } from "@/lib/automation/schema";
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
  source?: string;
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

export async function upsertPipeline(p: Pipeline, workspaceId?: string | null): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const base: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    description: p.description,
    graph: graphOf(p),
    is_template: false,
  };
  // Attach the active workspace on create (migration 0015). Falls back if the column isn't applied.
  if (workspaceId) {
    const withWs = await sb.from("pipelines").upsert({ ...base, workspace_id: workspaceId }, { onConflict: "id" });
    if (!withWs.error) return true;
  }
  const { error } = await sb.from("pipelines").upsert(base, { onConflict: "id" });
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
      takeId: run.takeId ?? null,
      costUsd: run.costUsd ?? null,
      latencyMs: run.latencyMs ?? null,
      source: run.source ?? null,
    },
    tables: run.tables,
    final_output: run.finalOutput ?? null,
    started_at: run.startedAt ?? null,
    finished_at: run.finishedAt ?? null,
  };
  // Try with the source column (migration 0013); fall back if it isn't applied yet.
  const withSource = await sb.from("runs").insert({ ...base, source: run.source ?? "manual" });
  if (!withSource.error) return true;
  const { error } = await sb.from("runs").insert(base);
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
  // Try with the source column (migration 0013); fall back if it isn't applied yet.
  const withSource = await sb
    .from("runs")
    .select("id,pipeline_id,status,final_output,created_at,source")
    .order("created_at", { ascending: false })
    .limit(limit);
  const data = withSource.error
    ? (
        await sb
          .from("runs")
          .select("id,pipeline_id,status,final_output,created_at")
          .order("created_at", { ascending: false })
          .limit(limit)
      ).data
    : withSource.data;
  if (!data) return [];
  return (data as (RunRow & { source?: string | null })[]).map((r) => ({
    id: r.id,
    pipelineId: r.pipeline_id,
    status: r.status,
    title: stringField(r.final_output, "title", "Run"),
    createdAt: r.created_at,
    source: r.source ?? undefined,
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

/* ── Library assets (reusable nodes / prompts / tools) ───────────────── */

export async function listLibraryAssets(): Promise<LibraryAsset[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("library_assets").select("*").order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).flatMap((r) => {
    try {
      return [
        libraryAssetSchema.parse({
          id: r.id,
          kind: r.kind,
          name: r.name ?? "Untitled",
          description: r.description ?? undefined,
          payload: r.payload ?? {},
          tags: r.tags ?? [],
          usageCount: r.usage_count ?? 0,
          createdAt: r.created_at ?? new Date().toISOString(),
          updatedAt: r.updated_at ?? new Date().toISOString(),
        }),
      ];
    } catch {
      return [];
    }
  });
}

export async function saveLibraryAsset(a: LibraryAsset): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("library_assets").upsert(
    {
      id: a.id,
      kind: a.kind,
      name: a.name,
      description: a.description ?? null,
      payload: a.payload,
      tags: a.tags,
      usage_count: a.usageCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  return !error;
}

export async function deleteLibraryAsset(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("library_assets").delete().eq("id", id);
  return !error;
}

/* ── Pipeline shares (owner-side management) ─────────────────────────── */

function rowToShare(r: Record<string, unknown>): PipelineShare | null {
  try {
    return pipelineShareSchema.parse({
      id: r.id,
      pipelineId: r.pipeline_id,
      ownerId: (r.user_id as string | null) ?? null,
      level: r.level ?? "run",
      recipients: r.recipients ?? [],
      linkEnabled: r.link_enabled ?? false,
      linkToken: (r.link_token as string | null) ?? undefined,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: r.updated_at ?? new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function listShares(pipelineId: string): Promise<PipelineShare[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pipeline_shares")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).flatMap((r) => {
    const s = rowToShare(r);
    return s ? [s] : [];
  });
}

export async function upsertShare(s: PipelineShare): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pipeline_shares").upsert(
    {
      id: s.id,
      pipeline_id: s.pipelineId,
      level: s.level,
      recipients: s.recipients,
      link_enabled: s.linkEnabled,
      link_token: s.linkToken ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  return !error;
}

export async function deleteShare(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pipeline_shares").delete().eq("id", id);
  return !error;
}

export async function listShareRuns(shareId: string): Promise<ShareRun[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("share_runs")
    .select("*")
    .eq("share_id", shareId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).flatMap((r) => {
    try {
      return [
        shareRunSchema.parse({
          id: r.id,
          shareId: r.share_id,
          requesterRef: (r.requester_ref as string | null) ?? undefined,
          status: r.status ?? "unknown",
          durationMs: (r.duration_ms as number | null) ?? undefined,
          costUsd: (r.cost_usd as number | null) ?? undefined,
          inputKeys: (r.input_keys as string[] | null) ?? [],
          runId: (r.run_id as string | null) ?? undefined,
          createdAt: r.created_at ?? new Date().toISOString(),
        }),
      ];
    } catch {
      return [];
    }
  });
}

/* ── Triggers (automation) ───────────────────────────────────────────── */

export function rowToTrigger(r: Record<string, unknown>): Trigger | null {
  try {
    return triggerSchema.parse({
      id: r.id,
      pipelineId: r.pipeline_id,
      ownerId: (r.user_id as string | null) ?? null,
      enabled: r.enabled ?? true,
      type: r.type,
      name: r.name ?? "",
      schedule: r.schedule ?? undefined,
      webhook: r.webhook ?? undefined,
      upstreamPipelineId: (r.upstream_pipeline_id as string | null) ?? undefined,
      defaultInputs: r.default_inputs ?? {},
      retry: r.retry ?? undefined,
      alerts: r.alerts ?? undefined,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: r.updated_at ?? new Date().toISOString(),
      lastFiredAt: (r.last_fired_at as string | null) ?? undefined,
      lastStatus: (r.last_status as string | null) ?? undefined,
      retryAttempt: (r.retry_attempt as number | null) ?? undefined,
      nextRetryAt: (r.next_retry_at as string | null) ?? undefined,
      lastError: (r.last_error as string | null) ?? undefined,
      alertedFailure: (r.alerted_failure as boolean | null) ?? undefined,
    });
  } catch {
    return null;
  }
}

export function triggerToRow(t: Trigger): Record<string, unknown> {
  return {
    id: t.id,
    pipeline_id: t.pipelineId,
    enabled: t.enabled,
    type: t.type,
    name: t.name,
    schedule: t.schedule ?? null,
    webhook: t.webhook ?? null,
    upstream_pipeline_id: t.upstreamPipelineId ?? null,
    default_inputs: t.defaultInputs,
    retry: t.retry ?? null,
    alerts: t.alerts ?? null,
    last_fired_at: t.lastFiredAt ?? null,
    last_status: t.lastStatus ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function listTriggerRuns(triggerId: string, limit = 20): Promise<TriggerRun[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("trigger_runs")
    .select("*")
    .eq("trigger_id", triggerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).flatMap((r) => {
    try {
      return [
        triggerRunSchema.parse({
          id: r.id,
          triggerId: r.trigger_id,
          runId: (r.run_id as string | null) ?? undefined,
          status: r.status ?? "unknown",
          attempt: (r.attempt as number | null) ?? 1,
          durationMs: (r.duration_ms as number | null) ?? undefined,
          costUsd: (r.cost_usd as number | null) ?? undefined,
          error: (r.error as string | null) ?? undefined,
          startedAt: (r.started_at as string | null) ?? undefined,
          createdAt: r.created_at ?? new Date().toISOString(),
        }),
      ];
    } catch {
      return [];
    }
  });
}

export async function listTriggers(pipelineId?: string): Promise<Trigger[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from("triggers").select("*").order("created_at", { ascending: false });
  if (pipelineId) q = q.eq("pipeline_id", pipelineId);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).flatMap((r) => {
    const t = rowToTrigger(r);
    return t ? [t] : [];
  });
}

export async function upsertTrigger(t: Trigger): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("triggers").upsert(triggerToRow(t), { onConflict: "id" });
  return !error;
}

export async function deleteTrigger(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("triggers").delete().eq("id", id);
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
