import {
  DEFAULT_MODEL_ID,
  MODELS,
  type Capability,
  type ModelConfig,
} from "./providers";

export type RecommendOptions = {
  needs?: Capability[];
  budget?: "low" | "medium" | "high";
  /** only consider providers we can actually execute today */
  wiredOnly?: boolean;
};

/** Recommend a model for a node/agent from its needs + budget. Heuristic, deterministic. */
export function recommendModel(opts: RecommendOptions = {}): string {
  const { needs = [], budget = "medium", wiredOnly = true } = opts;
  const pool = (wiredOnly ? MODELS.filter((m) => m.wired) : MODELS).slice();
  if (pool.length === 0) return DEFAULT_MODEL_ID;

  const budgetWeight = budget === "low" ? 1.2 : budget === "high" ? 0.2 : 0.6;

  const score = (m: ModelConfig) => {
    let s = 0;
    for (const n of needs) if (m.capabilities.includes(n)) s += 2;
    if (needs.includes("reasoning") && m.speed === "frontier") s += 1.5;
    if (needs.includes("speed") && (m.speed === "fast" || m.speed === "instant")) s += 1.5;
    if (needs.includes("long-context")) s += Math.min(m.contextTokens / 500_000, 2);
    // cheaper is better, weighted by budget
    const avgCost = (m.inputCostPerM + m.outputCostPerM) / 2;
    s -= avgCost * budgetWeight * 0.1;
    return s;
  };

  return pool.sort((a, b) => score(b) - score(a))[0]?.id ?? DEFAULT_MODEL_ID;
}

/** A one-line rationale for the recommendation (for tooltips). */
export function recommendWithReason(opts: RecommendOptions = {}): { id: string; reason: string } {
  const id = recommendModel(opts);
  const needs = opts.needs ?? [];
  const reason = needs.length
    ? `Best fit for ${needs.join(", ")} at ${opts.budget ?? "medium"} budget.`
    : "Balanced default for general agent work.";
  return { id, reason };
}
