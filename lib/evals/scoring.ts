import type { OutputTable } from "@/lib/pipeline/schema";
import type { EvalResult, EvalScore } from "./schema";

export function aggregate(scores: EvalScore[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length);
}

export function verdictFor(overall: number): EvalResult["verdict"] {
  if (overall >= 75) return "pass";
  if (overall >= 50) return "warn";
  return "fail";
}

/** Deterministic completeness/structure scoring for a table — a usable V1 eval-node stub
 *  before a real judge model is wired. */
export function scoreTableCompleteness(nodeId: string, table: OutputTable): EvalResult {
  const cols = table.columns.length || 1;
  const rows = table.rows.length;
  let filled = 0;
  let total = 0;
  for (const r of table.rows) {
    for (const c of table.columns) {
      total += 1;
      const v = r[c.key];
      if (v !== null && v !== undefined && v !== "") filled += 1;
    }
  }
  const completeness = total ? Math.round((filled / total) * 100) : 0;
  const structure = Math.min(100, cols * 12 + (rows > 0 ? 40 : 0));
  const scores: EvalScore[] = [
    { dimension: "data_completeness", score: completeness },
    { dimension: "structure", score: structure },
  ];
  const overall = aggregate(scores);
  return {
    nodeId,
    overall,
    verdict: verdictFor(overall),
    scores,
    summary: `${rows} rows × ${cols} cols, ${completeness}% cells populated.`,
  };
}
