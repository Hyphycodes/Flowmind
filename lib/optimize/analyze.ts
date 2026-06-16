import type { Pipeline, PipelineNode, RunTrace } from "@/lib/pipeline/schema";
import { DEFAULT_FAST_MODEL_ID, getModel } from "@/lib/models/providers";
import { descendantsOf } from "@/lib/pipeline/graph";
import { nodeMetrics } from "@/lib/trace/metrics";

/** Auto-Optimize analyzer (Task 01b). Deterministic, no LLM. Reads a completed run + the pipeline
 *  and flags concrete, evidence-backed savings. Every estimate derives from real trace numbers +
 *  known model tier pricing — never fabricated. Findings route through the existing diff flow. */

export type OptimizeFinding = {
  id: string;
  kind: "over_modeled" | "independent_sequential" | "redundant";
  title: string;
  nodeIds: string[];
  estSavingUsd?: number;
  estSavingMs?: number;
  confidence: "high" | "medium" | "low";
  note: string;
  /** how Apply routes through the diff flow (Task 03); redundant is flag-only */
  remixAction?: "route_models" | "parallelize";
  request?: string;
  suggestedModelId?: string;
};

const LIGHT_JOB = /(extract|parse|format|normaliz|classif|rout|tag|label|transform|pull|scrape|dedupe|clean|convert|split|lookup|sort|filter)/i;

function isLightJob(node: PipelineNode): boolean {
  if (node.type === "transformer" || node.type === "tool") return true;
  return LIGHT_JOB.test(`${node.role} ${node.prompt} ${node.title}`);
}

function isHeavyModel(modelId: string): boolean {
  const m = getModel(modelId);
  if (!m) return false;
  return m.costTier === "premium" || m.costTier === "expensive" || m.speedTier === "slow";
}

function rate(modelId: string): number {
  const m = getModel(modelId);
  return m ? m.inputCostPerM + m.outputCostPerM : 0;
}

function hash(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

export function analyzeRun(pipeline: Pipeline, trace: RunTrace, priorTrace?: RunTrace | null): OptimizeFinding[] {
  const findings: OptimizeFinding[] = [];
  const metrics = nodeMetrics(trace.steps, trace.agentRuns, trace.teamRuns);
  const fast = getModel(DEFAULT_FAST_MODEL_ID);

  // ── Over-modeled nodes: a light job on a heavy/expensive model ──────────────
  if (fast) {
    for (const node of pipeline.nodes) {
      if (node.team || node.type === "input" || node.type === "output") continue;
      if (!isHeavyModel(node.model) || !isLightJob(node)) continue;
      if (node.model === fast.id) continue;
      const curRate = rate(node.model);
      const fastRate = rate(fast.id);
      if (!curRate || fastRate >= curRate) continue;
      const cost = metrics.get(node.id)?.costUsd;
      const estSavingUsd = cost != null ? cost * (1 - fastRate / curRate) : undefined;
      const cur = getModel(node.model);
      findings.push({
        id: `opt-model-${node.id}`,
        kind: "over_modeled",
        title: `Route ${node.title} to ${fast.displayName}`,
        nodeIds: [node.id],
        estSavingUsd,
        confidence: cost != null ? "high" : "medium",
        note: `${node.title} does light work (${node.type === "transformer" || node.type === "tool" ? node.type : "extraction/formatting"}) on ${cur?.displayName ?? node.model} — a fast tier should match it.`,
        remixAction: "route_models",
        request: `Route ${node.title} to a cheaper, faster model — it does light work, not hard reasoning.`,
        suggestedModelId: fast.id,
      });
    }
  }

  // ── Sequential-but-independent nodes → parallelize ──────────────────────────
  const order = trace.steps.map((s) => s.nodeId).filter((id) => {
    const n = pipeline.nodes.find((x) => x.id === id);
    return n && n.type !== "input" && n.type !== "output";
  });
  const desc = new Map<string, Set<string>>();
  const descOf = (id: string) => {
    if (!desc.has(id)) desc.set(id, descendantsOf(pipeline, id));
    return desc.get(id)!;
  };
  let bestPair: { a: string; b: string; saving: number } | null = null;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const a = order[i];
      const b = order[j];
      if (descOf(a).has(b) || descOf(b).has(a)) continue; // a dependency exists → not independent
      const da = metrics.get(a)?.durationMs ?? 0;
      const db = metrics.get(b)?.durationMs ?? 0;
      const saving = Math.min(da, db);
      if (saving > 300 && (!bestPair || saving > bestPair.saving)) bestPair = { a, b, saving };
    }
  }
  if (bestPair) {
    const an = pipeline.nodes.find((n) => n.id === bestPair!.a);
    const bn = pipeline.nodes.find((n) => n.id === bestPair!.b);
    if (an && bn) {
      findings.push({
        id: `opt-par-${an.id}-${bn.id}`,
        kind: "independent_sequential",
        title: `Run ${an.title} and ${bn.title} in parallel`,
        nodeIds: [an.id, bn.id],
        estSavingMs: bestPair.saving,
        confidence: "medium",
        note: `${an.title} and ${bn.title} ran one after another but neither depends on the other.`,
        remixAction: "parallelize",
        request: `Run ${an.title} and ${bn.title} in parallel — they have no data dependency on each other.`,
      });
    }
  }

  // ── Redundant re-computation: inputs unchanged since the last run ────────────
  if (priorTrace) {
    const priorByNode = new Map(priorTrace.steps.map((s) => [s.nodeId, s]));
    for (const step of trace.steps) {
      if (step.input == null) continue;
      const prior = priorByNode.get(step.nodeId);
      if (!prior || prior.input == null) continue;
      if (hash(prior.input) !== hash(step.input)) continue;
      const node = pipeline.nodes.find((n) => n.id === step.nodeId);
      if (!node || node.type === "input") continue;
      findings.push({
        id: `opt-cache-${step.nodeId}`,
        kind: "redundant",
        title: `Cache ${node.title} — inputs didn't change`,
        nodeIds: [node.id],
        estSavingUsd: metrics.get(node.id)?.costUsd,
        estSavingMs: step.durationMs,
        confidence: "medium",
        note: `${node.title} re-ran with the same inputs as the previous run; caching its result would skip the work.`,
      });
    }
  }

  // Rank: biggest saving first (cost-weighted, with time as a tiebreaker).
  return findings.sort((a, b) => (b.estSavingUsd ?? 0) - (a.estSavingUsd ?? 0) || (b.estSavingMs ?? 0) - (a.estSavingMs ?? 0));
}
