import {
  DEFAULT_EVALUATOR_MODEL_ID,
  DEFAULT_FAST_MODEL_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_STRUCTURED_MODEL_ID,
  DEFAULT_VISION_MODEL_ID,
  FALLBACK_MODEL_ID,
  MODELS,
  type Capability,
  type ModelCapability,
  type ModelConfig,
} from "./providers";

export type RecommendOptions = {
  needs?: Capability[];
  budget?: "low" | "medium" | "high";
  /** only consider providers we can actually execute today */
  wiredOnly?: boolean;
};

export type ModelRecommendation = {
  nodeId?: string;
  agentId?: string;
  recommendedModelId: string;
  fallbackModelIds: string[];
  reason: string;
  capabilityMatch: ModelCapability[];
  warnings: string[];
};

export type ModelRouterInput = {
  nodeId?: string;
  agentId?: string;
  nodeType?: string;
  role?: string;
  requiredCapabilities?: ModelCapability[];
  expectedDataSize?: "small" | "medium" | "large";
  costPreference?: "low" | "medium" | "high";
  speedPreference?: "low" | "medium" | "high";
  structuredOutputRequired?: boolean;
  toolUsageRequired?: boolean;
  visionRequired?: boolean;
  wiredOnly?: boolean;
};

function scoreModel(model: ModelConfig, input: ModelRouterInput): number {
  const required = new Set(input.requiredCapabilities ?? []);
  let score = 0;
  for (const cap of required) if (model.capabilityTags.includes(cap)) score += 3;
  if (input.structuredOutputRequired && model.supportsStructuredOutput) score += 4;
  if (input.toolUsageRequired && model.supportsTools) score += 3;
  if (input.visionRequired && model.supportsVision) score += 4;
  if (input.speedPreference === "high" && ["fast", "very_fast"].includes(model.speedTier)) score += 2;
  if (input.costPreference === "low" && model.costTier === "cheap") score += 2;
  if (input.expectedDataSize === "large") score += Math.min(model.contextWindow / 300000, 3);
  if (input.nodeType === "evaluator" && model.capabilityTags.includes("evaluation")) score += 2;
  if (input.nodeType === "output" && model.capabilityTags.includes("writing")) score += 2;

  const role = (input.role ?? "").toLowerCase();
  if (role.includes("classif") && model.capabilityTags.includes("classification")) score += 3;
  if (role.includes("router") && model.capabilityTags.includes("routing")) score += 3;
  if (role.includes("judge") && model.capabilityTags.includes("evaluation")) score += 3;
  if (role.includes("vision") && model.supportsVision) score += 3;
  if (role.includes("writer") && model.capabilityTags.includes("writing")) score += 2;

  if (model.id === DEFAULT_MODEL_ID) score += 0.5;
  if (input.structuredOutputRequired && model.id === DEFAULT_STRUCTURED_MODEL_ID) score += 1;
  if (input.visionRequired && model.id === DEFAULT_VISION_MODEL_ID) score += 1;
  if (input.nodeType === "evaluator" && model.id === DEFAULT_EVALUATOR_MODEL_ID) score += 1;
  if (input.speedPreference === "high" && model.id === DEFAULT_FAST_MODEL_ID) score += 1;

  return score;
}

function capabilitiesFor(input: ModelRouterInput): ModelCapability[] {
  const caps = new Set<ModelCapability>(input.requiredCapabilities ?? []);
  if (input.nodeType === "evaluator") caps.add("evaluation");
  if (input.nodeType === "output") caps.add("writing");
  if (input.structuredOutputRequired) caps.add("structured_output");
  if (input.toolUsageRequired) caps.add("tool_calling");
  if (input.visionRequired) caps.add("vision");
  if (input.speedPreference === "high") caps.add("fast");
  if (input.costPreference === "low") caps.add("cheap");
  if (input.expectedDataSize === "large") caps.add("long_context");
  const role = (input.role ?? "").toLowerCase();
  if (role.includes("classif")) caps.add("classification");
  if (role.includes("router")) caps.add("routing");
  if (role.includes("judge")) caps.add("evaluation");
  return [...caps];
}

export function recommendModelForNode(input: ModelRouterInput): ModelRecommendation {
  const capabilityMatch = capabilitiesFor(input);
  const pool = (input.wiredOnly ? MODELS.filter((m) => m.wired) : MODELS).filter((m) => m.enabled);
  const sorted = pool
    .slice()
    .sort((a, b) => scoreModel(b, { ...input, requiredCapabilities: capabilityMatch }) - scoreModel(a, { ...input, requiredCapabilities: capabilityMatch }));
  const recommended = sorted[0] ?? MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODELS[0];
  const fallbackModelIds = sorted
    .filter((m) => m.id !== recommended?.id)
    .slice(0, 2)
    .map((m) => m.id);
  if (!fallbackModelIds.includes(FALLBACK_MODEL_ID) && recommended?.id !== FALLBACK_MODEL_ID) {
    fallbackModelIds.push(FALLBACK_MODEL_ID);
  }
  const warnings =
    input.wiredOnly && recommended && !recommended.wired
      ? ["Recommended model is not wired for execution yet."]
      : [];

  return {
    nodeId: input.nodeId,
    agentId: input.agentId,
    recommendedModelId: recommended?.id ?? DEFAULT_MODEL_ID,
    fallbackModelIds,
    reason: reasonFor(recommended, capabilityMatch, input),
    capabilityMatch,
    warnings,
  };
}

export function recommendModelForAgent(input: ModelRouterInput): ModelRecommendation {
  return recommendModelForNode(input);
}

function reasonFor(model: ModelConfig | undefined, caps: ModelCapability[], input: ModelRouterInput): string {
  if (!model) return "No configured model matched, so Flowmind falls back to the default model.";
  if (caps.includes("vision")) return `${model.displayName} is recommended because this job needs image understanding.`;
  if (caps.includes("classification") || caps.includes("routing")) {
    return `${model.displayName} is recommended because this job is mostly fast classification or routing.`;
  }
  if (caps.includes("evaluation")) return `${model.displayName} is recommended because this node is judging or scoring output.`;
  if (caps.includes("structured_output")) return `${model.displayName} is recommended because this node needs reliable structured output.`;
  if (input.costPreference === "low") return `${model.displayName} is recommended because it balances capability with lower cost.`;
  return `${model.displayName} is recommended as a strong fit for this node's role.`;
}

/** Backward-compatible helper used by existing code. */
export function recommendModel(opts: RecommendOptions = {}): string {
  const capabilityMap: Partial<Record<Capability, ModelCapability>> = {
    reasoning: "reasoning",
    writing: "writing",
    classification: "classification",
    structured_output: "structured_output",
    tool_calling: "tool_calling",
    vision: "vision",
    long_context: "long_context",
    fast: "fast",
    cheap: "cheap",
    coding: "coding",
    evaluation: "evaluation",
    routing: "routing",
  };
  const requiredCapabilities = (opts.needs ?? []).flatMap((cap) => {
    const mapped = capabilityMap[cap];
    return mapped ? [mapped] : [];
  });
  return recommendModelForNode({
    requiredCapabilities,
    costPreference: opts.budget === "low" ? "low" : opts.budget === "high" ? "high" : "medium",
    wiredOnly: opts.wiredOnly ?? true,
  }).recommendedModelId;
}

/** A one-line rationale for the recommendation (for tooltips). */
export function recommendWithReason(opts: RecommendOptions = {}): { id: string; reason: string } {
  const rec = recommendModelForNode({
    requiredCapabilities: (opts.needs ?? []) as ModelCapability[],
    costPreference: opts.budget === "low" ? "low" : opts.budget === "high" ? "high" : "medium",
    wiredOnly: opts.wiredOnly ?? true,
  });
  return { id: rec.recommendedModelId, reason: rec.reason };
}
