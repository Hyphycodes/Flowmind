import type { RunStep, RunTrace } from "@/lib/pipeline/schema";

/** Per-node diff between two runs (Task 01 — run diff). Reuses the existing Takes compare
 *  primitive: each Take carries a full RunTrace, so we line up their steps node-by-node and
 *  flag what changed, got slower, or got more expensive between run `a` (older) and `b` (newer). */

export type NodeDiffRow = {
  nodeId: string;
  title: string;
  aStatus?: RunStep["status"];
  bStatus?: RunStep["status"];
  aCostUsd?: number;
  bCostUsd?: number;
  aDurationMs?: number;
  bDurationMs?: number;
  outputChanged: boolean;
  statusChanged: boolean;
  slower: boolean;
  faster: boolean;
  costlier: boolean;
  cheaper: boolean;
  onlyIn?: "a" | "b";
};

function hash(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

export function diffTraces(a: RunTrace, b: RunTrace): NodeDiffRow[] {
  const aSteps = new Map(a.steps.map((s) => [s.nodeId, s]));
  const bSteps = new Map(b.steps.map((s) => [s.nodeId, s]));
  // Order by the newer run, then any nodes only in the older run.
  const order = [...b.steps.map((s) => s.nodeId), ...a.steps.map((s) => s.nodeId).filter((id) => !bSteps.has(id))];
  const seen = new Set<string>();

  const rows: NodeDiffRow[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const sa = aSteps.get(id);
    const sb = bSteps.get(id);
    const aDur = sa?.durationMs;
    const bDur = sb?.durationMs;
    const aCost = sa?.costUsd;
    const bCost = sb?.costUsd;
    const bothRan = Boolean(sa && sb);
    rows.push({
      nodeId: id,
      title: sb?.title ?? sa?.title ?? id,
      aStatus: sa?.status,
      bStatus: sb?.status,
      aCostUsd: aCost,
      bCostUsd: bCost,
      aDurationMs: aDur,
      bDurationMs: bDur,
      outputChanged: bothRan && hash(sa!.output) !== hash(sb!.output),
      statusChanged: bothRan && sa!.status !== sb!.status,
      // Meaningful deltas only: ignore sub-100ms / sub-tenth-cent noise.
      slower: aDur != null && bDur != null && bDur - aDur > 100 && bDur > aDur * 1.15,
      faster: aDur != null && bDur != null && aDur - bDur > 100 && aDur > bDur * 1.15,
      costlier: aCost != null && bCost != null && bCost - aCost > 0.0001 && bCost > aCost * 1.05,
      cheaper: aCost != null && bCost != null && aCost - bCost > 0.0001 && aCost > bCost * 1.05,
      onlyIn: !sa ? "b" : !sb ? "a" : undefined,
    });
  }
  return rows;
}
