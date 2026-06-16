import type {
  AgentRunTrace,
  NodeStatus,
  RunStep,
  TeamRunTrace,
} from "@/lib/pipeline/schema";

/** Per-node run economics, read from the existing run state. Single-agent nodes may not carry a
 *  top-level `costUsd`, so we fall back to summing their agent/team traces — keeping the number
 *  honest (only what the trace actually recorded). Shared by the canvas overlay, the run timeline,
 *  and the optimizer (Task 01b). */

export type NodeRunMetric = {
  durationMs: number;
  costUsd?: number;
  status?: NodeStatus;
};

export function nodeMetric(
  nodeId: string,
  steps: RunStep[],
  agentRuns: AgentRunTrace[],
  teamRuns: TeamRunTrace[],
): NodeRunMetric | null {
  const step = steps.find((s) => s.nodeId === nodeId);
  const agentCost = agentRuns
    .filter((t) => t.teamNodeId === nodeId)
    .reduce((sum, t) => sum + (t.costUsd ?? 0), 0);
  const teamCost = teamRuns
    .filter((t) => t.teamNodeId === nodeId)
    .reduce((sum, t) => sum + (t.costUsd ?? 0), 0);
  const costUsd =
    step?.costUsd != null ? step.costUsd : agentCost > 0 ? agentCost : teamCost > 0 ? teamCost : undefined;
  if (!step && costUsd == null) return null;
  return { durationMs: step?.durationMs ?? 0, costUsd, status: step?.status };
}

export function nodeMetrics(
  steps: RunStep[],
  agentRuns: AgentRunTrace[],
  teamRuns: TeamRunTrace[],
): Map<string, NodeRunMetric> {
  const out = new Map<string, NodeRunMetric>();
  const ids = new Set<string>([
    ...steps.map((s) => s.nodeId),
    ...agentRuns.map((t) => t.teamNodeId),
    ...teamRuns.map((t) => t.teamNodeId),
  ]);
  for (const id of ids) {
    const m = nodeMetric(id, steps, agentRuns, teamRuns);
    if (m) out.set(id, m);
  }
  return out;
}

/** Total cost across a set of steps (folds step costs; falls back to a provided total). */
export function totalCost(steps: RunStep[], fallback?: number): number | undefined {
  const summed = steps.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
  if (summed > 0) return summed;
  return fallback;
}

export function totalDuration(steps: RunStep[]): number {
  return steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
}
