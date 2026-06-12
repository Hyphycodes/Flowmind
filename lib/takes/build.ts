import type { ExecutionMode, Pipeline, RunTrace, Take } from "@/lib/pipeline/schema";
import type { EvalResult } from "@/lib/evals/schema";
import { overallScore } from "@/lib/evals/runEval";
import { newId } from "@/lib/pipeline/validate";

/** Build Takes from finished runs + compare them. The whole point of Takes:
 *  run the same system different ways and see which variation is best. */

export type RunCostSummary = {
  totalCostUsd: number;
  totalLatencyMs: number;
  warningCount: number;
  modelsUsed: string[];
  mostExpensiveTeam?: { name: string; costUsd: number };
  slowestTeam?: { name: string; latencyMs: number };
};

export function summarizeRunCost(trace: RunTrace): RunCostSummary {
  const teamCost = trace.teamRuns.reduce((s, t) => s + (t.costUsd ?? 0), 0);
  const agentCost = trace.agentRuns.reduce((s, a) => s + (a.costUsd ?? 0), 0);
  const totalCostUsd = trace.costUsd ?? teamCost + agentCost;

  const stepLatency = trace.steps.reduce((s, st) => s + (st.durationMs ?? 0), 0);
  const totalLatencyMs = trace.latencyMs ?? stepLatency;

  const warningCount =
    (trace.packetWarnings?.length ?? 0) +
    trace.teamRuns.reduce((s, t) => s + (t.warnings?.length ?? 0), 0) +
    trace.agentRuns.reduce((s, a) => s + (a.warnings?.length ?? 0), 0);

  const modelsUsed = Array.from(
    new Set(
      [
        ...trace.steps.map((s) => s.model),
        ...trace.teamRuns.flatMap((t) => t.agentRuns.map((a) => a.model)),
        ...trace.agentRuns.map((a) => a.model),
      ].filter(Boolean) as string[],
    ),
  );

  const teamsByCost = [...trace.teamRuns].sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0));
  const teamsByLatency = [...trace.teamRuns].sort((a, b) => (b.latencyMs ?? 0) - (a.latencyMs ?? 0));
  const mostExpensiveTeam = teamsByCost[0]?.costUsd
    ? { name: teamsByCost[0].teamName, costUsd: teamsByCost[0].costUsd ?? 0 }
    : undefined;
  const slowestTeam = teamsByLatency[0]?.latencyMs
    ? { name: teamsByLatency[0].teamName, latencyMs: teamsByLatency[0].latencyMs ?? 0 }
    : undefined;

  return { totalCostUsd, totalLatencyMs, warningCount, modelsUsed, mostExpensiveTeam, slowestTeam };
}

export function buildTake(input: {
  pipeline: Pipeline;
  trace: RunTrace;
  evalResults: EvalResult[];
  mode: ExecutionMode;
  name?: string;
  description?: string;
}): Take {
  const { pipeline, trace, evalResults, mode } = input;
  const cost = summarizeRunCost(trace);
  const overall = overallScore(evalResults);
  const status: Take["status"] =
    trace.status === "error" ? "error" : cost.warningCount > 0 ? "warning" : "success";

  const modelSelections: Record<string, string> = {};
  for (const n of pipeline.nodes) modelSelections[n.id] = n.model;

  return {
    id: newId("take"),
    pipelineId: pipeline.id,
    name: input.name ?? defaultTakeName(mode),
    description: input.description ?? "",
    mode,
    status,
    runTraceId: trace.id,
    trace,
    modelSelections,
    scores: Object.fromEntries(
      (evalResults.find((r) => r.nodeId === "__overall__")?.scores ?? []).map((s) => [s.dimension, s.score]),
    ),
    evalResults,
    overallScore: overall,
    costUsd: cost.totalCostUsd,
    latencyMs: cost.totalLatencyMs,
    warningCount: cost.warningCount,
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

function defaultTakeName(mode: ExecutionMode): string {
  const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const label = mode === "simulate" ? "Simulated" : mode === "hybrid" ? "Hybrid" : "Live";
  return `${label} run · ${stamp}`;
}

/* ── Take comparison ─────────────────────────────────────────────────── */

export type TakeComparisonRow = {
  takeId: string;
  name: string;
  mode?: ExecutionMode;
  status: Take["status"];
  overallScore: number;
  costUsd?: number;
  latencyMs?: number;
  warningCount: number;
  modelsLabel: string;
  best: boolean;
};

export type TakeComparison = {
  rows: TakeComparisonRow[];
  dimensions: { dimension: string; scores: Record<string, number> }[];
  bestTakeId?: string;
};

function modelsLabel(t: Take): string {
  const models = Array.from(new Set(Object.values(t.modelSelections))).map((m) => m.replace("claude-", ""));
  if (!models.length) return "—";
  return models.length <= 2 ? models.join(", ") : `${models.slice(0, 2).join(", ")} +${models.length - 2}`;
}

export function compareTakes(takes: Take[]): TakeComparison {
  if (!takes.length) return { rows: [], dimensions: [] };
  const bestTakeId = [...takes].sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0]?.id;

  const rows: TakeComparisonRow[] = takes.map((t) => ({
    takeId: t.id,
    name: t.name,
    mode: t.mode,
    status: t.status,
    overallScore: t.overallScore ?? 0,
    costUsd: t.costUsd,
    latencyMs: t.latencyMs,
    warningCount: t.warningCount ?? 0,
    modelsLabel: modelsLabel(t),
    best: t.id === bestTakeId,
  }));

  // Per-dimension matrix from each take's overall eval result.
  const dimSet = new Set<string>();
  for (const t of takes)
    for (const s of t.evalResults.find((r) => r.nodeId === "__overall__")?.scores ?? []) dimSet.add(s.dimension);

  const dimensions = [...dimSet].map((dimension) => {
    const scores: Record<string, number> = {};
    for (const t of takes) {
      const s = t.evalResults
        .find((r) => r.nodeId === "__overall__")
        ?.scores.find((x) => x.dimension === dimension);
      if (s) scores[t.id] = s.score;
    }
    return { dimension, scores };
  });

  return { rows, dimensions, bestTakeId };
}
