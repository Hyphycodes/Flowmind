import type { OutputTable, Pipeline, RunTrace } from "@/lib/pipeline/schema";
import { aggregate, verdictFor } from "./scoring";
import type { EvalResult, EvalScore } from "./schema";

/** Deterministic evaluator/judge runner. Runs without a model so every run gets
 *  inspectable eval scores. Derives dimension scores from the run's output tables,
 *  team confidence, completeness, and warnings. A real judge model can replace this
 *  later behind the same shape. */

type EvalCtx = {
  tables: OutputTable[];
  teamConfidence: number; // 0..1
  completeness: number; // 0..100
  warningCount: number;
};

const EMPTY = (v: unknown) => v === null || v === undefined || v === "";

function completenessOf(tables: OutputTable[]): number {
  let filled = 0;
  let total = 0;
  for (const t of tables)
    for (const r of t.rows)
      for (const c of t.columns) {
        total += 1;
        if (!EMPTY(r[c.key])) filled += 1;
      }
  return total ? Math.round((filled / total) * 100) : 0;
}

/** Average a numeric column matching `key` across all tables (percent or 0–1 → 0–100). */
function columnAverage(tables: OutputTable[], key: string): number | null {
  const vals: number[] = [];
  for (const t of tables) {
    if (!t.columns.some((c) => c.key === key)) continue;
    for (const r of t.rows) {
      const v = Number(r[key]);
      if (!Number.isNaN(v)) vals.push(v <= 1 ? v * 100 : v);
    }
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
}

/** Risk-style column ("low"/"medium"/"high") → inverted 0–100 score. */
function riskAverage(tables: OutputTable[], key: string): number | null {
  const map: Record<string, number> = { low: 90, medium: 65, high: 40 };
  const vals: number[] = [];
  for (const t of tables) {
    if (!t.columns.some((c) => c.key === key)) continue;
    for (const r of t.rows) {
      const s = String(r[key] ?? "").toLowerCase();
      if (s in map) vals.push(map[s]);
    }
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreDimension(dim: string, ctx: EvalCtx): EvalScore {
  const conf = ctx.teamConfidence * 100;
  // 1) direct numeric column match (e.g. taste_match, vibe_match, budget_fit)
  const col = columnAverage(ctx.tables, dim);
  if (col != null) return { dimension: dim, score: clamp(col), notes: "from output table" };

  // 2) risk-style dims
  if (/risk|corny/.test(dim)) {
    const risk = riskAverage(ctx.tables, dim) ?? riskAverage(ctx.tables, "corny_risk");
    if (risk != null) return { dimension: dim, score: clamp(risk), notes: "inverted risk" };
  }

  // 3) heuristics per dimension family
  const warnPenalty = Math.min(ctx.warningCount * 6, 30);
  switch (dim) {
    case "data_completeness":
      return { dimension: dim, score: clamp(ctx.completeness), notes: "cell fill rate" };
    case "structure":
      return { dimension: dim, score: clamp(40 + ctx.tables.length * 12), notes: "table coverage" };
    case "confidence":
      return { dimension: dim, score: clamp(conf), notes: "team confidence" };
    case "correctness":
    case "relevance":
    case "user_fit":
    case "actionability":
    case "location_fit":
    case "budget_fit":
      return { dimension: dim, score: clamp((conf + ctx.completeness) / 2 - warnPenalty) };
    case "freshness":
      return { dimension: dim, score: clamp(conf - warnPenalty * 0.5) };
    case "luxury_level":
    case "style":
      return { dimension: dim, score: clamp(conf * 0.9 + 10) };
    case "cost_speed":
    case "policy":
      return { dimension: dim, score: clamp(80 - warnPenalty) };
    default:
      return { dimension: dim, score: clamp((conf + ctx.completeness) / 2 - warnPenalty) };
  }
}

function ctxFor(trace: RunTrace, scopeTables?: OutputTable[]): EvalCtx {
  const tables = scopeTables ?? trace.tables;
  const teamConfs = trace.teamRuns.map((t) => t.confidence ?? 0).filter((x) => x > 0);
  const teamConfidence = teamConfs.length ? teamConfs.reduce((a, b) => a + b, 0) / teamConfs.length : 0.7;
  const warningCount =
    (trace.packetWarnings?.length ?? 0) +
    trace.teamRuns.reduce((s, t) => s + (t.warnings?.length ?? 0), 0);
  return { tables, teamConfidence, completeness: completenessOf(tables), warningCount };
}

function resultFromDimensions(nodeId: string, dims: string[], ctx: EvalCtx, summary: string): EvalResult {
  const scores = dims.map((d) => scoreDimension(d, ctx));
  const overall = aggregate(scores);
  return { nodeId, overall, verdict: verdictFor(overall), scores, summary };
}

const DEFAULT_DIMS = ["correctness", "data_completeness", "structure", "confidence"];

/** Run deterministic evals over a finished run. Returns one EvalResult per evaluator
 *  node (or any node declaring evalDimensions) plus an overall pipeline result. */
export function runEvals(pipeline: Pipeline, trace: RunTrace): EvalResult[] {
  const results: EvalResult[] = [];

  for (const node of pipeline.nodes) {
    const isEvaluator = node.type === "evaluator" || (node.evalDimensions?.length ?? 0) > 0;
    if (!isEvaluator) continue;
    const dims = node.evalDimensions?.length ? node.evalDimensions : DEFAULT_DIMS;
    const nodeTables = trace.tables.filter(
      (t) => t.sourceNodeId === node.id || node.outputs.includes(t.id),
    );
    const ctx = ctxFor(trace, nodeTables.length ? nodeTables : undefined);
    results.push(
      resultFromDimensions(node.id, dims, ctx, `${node.title}: ${dims.length} dimension(s) scored.`),
    );
  }

  // Always include an overall pipeline result.
  const overallCtx = ctxFor(trace);
  const overallDims = Array.from(
    new Set(["correctness", "data_completeness", "confidence", ...pipeline.nodes.flatMap((n) => n.evalDimensions ?? [])]),
  ).slice(0, 8);
  results.push(
    resultFromDimensions("__overall__", overallDims, overallCtx, "Overall pipeline quality."),
  );

  return results;
}

/** The single headline number for a run/take (0–100). */
export function overallScore(results: EvalResult[]): number {
  if (!results.length) return 0;
  const overall = results.find((r) => r.nodeId === "__overall__");
  if (overall) return overall.overall;
  return Math.round(results.reduce((s, r) => s + r.overall, 0) / results.length);
}
