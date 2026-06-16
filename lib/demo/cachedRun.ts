import type { Pipeline, RunTrace, OutputTable, HandoffPacket } from "@/lib/pipeline/schema";
import { researchCrewPipeline, RESEARCH_CREW_TAKES } from "@/lib/pipeline/teamFixtures";
import { researchPipeline, getTemplate } from "@/lib/pipeline/fixtures";

/**
 * Cached run data layer (Prompt 12) — the static fuel for the public `/try` demo (Prompt 13) and
 * the landing-page preview (Prompt 16). A `CachedRun` freezes everything the real canvas, inspector,
 * and trace views need to render the full experience with **zero AI calls and zero backend state**.
 *
 * Two levels of the same hero pipeline (a generic research crew → synthesis, NOT any do-not-ship
 * project) let the demo "bloom" from a simple single-agent shape to the deep nested-teams version:
 *   - `simple` — single-agent research engine (tpl-research).
 *   - `deep`   — multi-team Research Intelligence Crew with handoff packets + sample Takes.
 *
 * The graph, prompts, tables, packets, costs/latencies, and final output are the genuine fixture
 * data the app ships (deterministic + schema-valid). Replay metadata and the plain-English trace
 * explanation are derived deterministically below — no values are invented.
 */

export type DemoLevel = "simple" | "deep";

/** One node's slot in the replay timeline (activation order + relative timing). */
export type ReplayStep = {
  order: number;
  nodeId: string;
  title: string;
  /** ms offset from run start when this node lights up. */
  startMs: number;
  /** how long this node stays "active" in the replay. */
  durationMs: number;
  costUsd?: number;
};

/** The data that crossed one edge — what the edge-peek shows (a faithful sample, not invented). */
export type EdgePeek = {
  edgeId: string;
  source: string;
  target: string;
  dataKey: string;
  /** rows the source produced for this key (sampled for the peek). */
  rows: Record<string, unknown>[];
  rowCount: number;
  /** input-style key/value pairs when the edge carries the pipeline's input (no table). */
  fields?: { key: string; label: string; value: string }[];
};

export type CachedRun = {
  level: DemoLevel;
  /** Full graph: nodes (with teams + full prompt text), edges, positions, UI bindings. */
  pipeline: Pipeline;
  /** Genuine run trace: steps, output tables, handoff packets, final output, cost + latency. */
  run: RunTrace;
  /** Node activation order + relative timing so the replay animation is reproducible. */
  replay: ReplayStep[];
  /** What crossed each edge, for the edge-peek interaction. */
  edgePeeks: EdgePeek[];
  /** Plain-English trace explanation (summary + per-node flags), same shape as /api/explain-trace. */
  explanation: { summary: string; flags: { nodeId: string; severity: "info" | "warning" | "error"; message: string }[] };
};

/** Build the replay timeline from real step durations (cumulative offsets, original order). */
function buildReplay(run: RunTrace): ReplayStep[] {
  let cursor = 0;
  return run.steps.map((step, i) => {
    const startMs = cursor;
    const durationMs = step.durationMs ?? 0;
    cursor += durationMs;
    return {
      order: i,
      nodeId: step.nodeId,
      title: step.title,
      startMs,
      durationMs,
      costUsd: step.costUsd,
    };
  });
}

/** Map each edge to the data that crossed it: the source's output table rows, or the input fields. */
function buildEdgePeeks(pipeline: Pipeline, run: RunTrace): EdgePeek[] {
  const tableByKey = new Map<string, OutputTable>();
  for (const t of run.tables) {
    tableByKey.set(t.name, t);
    tableByKey.set(t.id, t);
  }
  return pipeline.edges.map((e) => {
    const key = e.dataKey ?? "";
    const table = tableByKey.get(key);
    if (table) {
      return {
        edgeId: e.id,
        source: e.source,
        target: e.target,
        dataKey: key,
        rows: table.rows.slice(0, 4) as Record<string, unknown>[],
        rowCount: table.rows.length,
      };
    }
    // No table for this key → it's the pipeline input; show the mock input fields.
    return {
      edgeId: e.id,
      source: e.source,
      target: e.target,
      dataKey: key,
      rows: [],
      rowCount: pipeline.mockInputs.length,
      fields: pipeline.mockInputs.map((f) => ({ key: f.key, label: f.label, value: String(f.value) })),
    };
  });
}

/** Derive a plain-English trace explanation from the real run (no model call). */
function buildExplanation(pipeline: Pipeline, run: RunTrace): CachedRun["explanation"] {
  const teamCount = pipeline.nodes.filter((n) => n.team).length;
  const tableCount = run.tables.length;
  const packetCount = run.packets.length;
  const cost = run.costUsd != null ? `$${run.costUsd.toFixed(3)}` : "—";
  const latency = run.latencyMs ? `${(run.latencyMs / 1000).toFixed(1)}s` : "—";
  const shape = teamCount > 0 ? `${teamCount} teams` : `${pipeline.nodes.length} agents`;
  const summary =
    `${pipeline.name} ran ${shape} end to end (${latency}, ${cost}), producing ${tableCount} ` +
    `output table${tableCount === 1 ? "" : "s"}` +
    (packetCount ? ` and ${packetCount} handoff packet${packetCount === 1 ? "" : "s"} between teams` : "") +
    `. ${typeof run.finalOutput?.summary === "string" ? run.finalOutput.summary : ""}`.trim();

  const flags: CachedRun["explanation"]["flags"] = [];
  // Surface real contract warnings carried on edges (e.g. the credibility_notes → credibility map).
  for (const e of pipeline.edges) {
    const warnings = e.contract?.warnings ?? [];
    for (const w of warnings) {
      flags.push({
        nodeId: e.target,
        severity: (w.severity as "info" | "warning" | "error") ?? "warning",
        message: w.message ?? "",
      });
    }
  }
  // Surface real packet warnings.
  for (const p of run.packets as HandoffPacket[]) {
    for (const w of p.warnings ?? []) {
      flags.push({ nodeId: p.toNodeId ?? "", severity: "info", message: w ?? "" });
    }
  }
  return { summary, flags };
}

function buildCachedRun(level: DemoLevel, pipeline: Pipeline, run: RunTrace): CachedRun {
  return {
    level,
    pipeline,
    run,
    replay: buildReplay(run),
    edgePeeks: buildEdgePeeks(pipeline, run),
    explanation: buildExplanation(pipeline, run),
  };
}

// ── Deep: the multi-team Research Intelligence Crew (real fixture run) ──────────────────────────
const deepTemplate = getTemplate("tpl-research-crew");
const DEEP: CachedRun = buildCachedRun(
  "deep",
  researchCrewPipeline,
  deepTemplate?.exampleRun ?? RESEARCH_CREW_TAKES[0].trace!,
);

// ── Simple: the single-agent research engine (real fixture run) ────────────────────────────────
const simpleTemplate = getTemplate("tpl-research");
const SIMPLE: CachedRun = buildCachedRun(
  "simple",
  researchPipeline,
  simpleTemplate!.exampleRun,
);

/**
 * Typed loader for the cached demo run. Returns frozen, committed data with **no network, no auth,
 * and no AI call** — it is a pure module import. `/try` and the landing preview consume this.
 */
export function getDemoRun(level: DemoLevel): CachedRun {
  return level === "deep" ? DEEP : SIMPLE;
}

/** Both levels, for callers that toggle between them (the simple↔advanced reveal). */
export const DEMO_RUNS: Record<DemoLevel, CachedRun> = { simple: SIMPLE, deep: DEEP };
