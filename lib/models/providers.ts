import { z } from "zod";

/** Provider/model registry. Flowmind can recommend many providers today, while
 *  actual execution is wired through Anthropic until more adapters are added. */

export const MODEL_PROVIDER_IDS = [
  "anthropic",
  "openai",
  "google",
  "vercel_gateway",
  "openrouter",
  "groq",
  "cerebras",
  "mistral",
  "ollama",
  "openai_compatible",
  "custom",
] as const;
export type ModelProviderId = (typeof MODEL_PROVIDER_IDS)[number];

export const PROVIDERS = MODEL_PROVIDER_IDS;
export type Provider = ModelProviderId;

export const MODEL_PROVIDER_STATUS = [
  "ready",
  "missing_key",
  "disabled",
  "error",
  "unknown",
] as const;
export type ModelProviderStatus = (typeof MODEL_PROVIDER_STATUS)[number];

export const MODEL_CAPABILITIES = [
  "reasoning",
  "writing",
  "classification",
  "structured_output",
  "tool_calling",
  "vision",
  "long_context",
  "fast",
  "cheap",
  "premium",
  "creative",
  "coding",
  "summarization",
  "evaluation",
  "routing",
  "embeddings",
] as const;
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export const CAPABILITIES = MODEL_CAPABILITIES;
export type Capability = ModelCapability;

export const SPEED_TIERS = ["slow", "medium", "fast", "very_fast"] as const;
export type SpeedTier = (typeof SPEED_TIERS)[number];

export const COST_TIERS = ["cheap", "standard", "premium", "expensive"] as const;
export type CostTier = (typeof COST_TIERS)[number];

export const modelProviderConfigSchema = z.object({
  id: z.enum(MODEL_PROVIDER_IDS),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  envKeyNames: z.array(z.string()).default([]),
  baseUrl: z.string().optional(),
  docsUrl: z.string().optional(),
  supportsToolCalling: z.boolean().default(false),
  supportsStructuredOutput: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsStreaming: z.boolean().default(false),
  supportsJsonMode: z.boolean().default(false),
  supportsEmbeddings: z.boolean().default(false),
  status: z.enum(MODEL_PROVIDER_STATUS).default("unknown"),
});
export type ModelProviderConfig = z.infer<typeof modelProviderConfigSchema>;

export const flowmindModelSchema = z.object({
  id: z.string(),
  providerId: z.enum(MODEL_PROVIDER_IDS),
  modelId: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  capabilityTags: z.array(z.enum(MODEL_CAPABILITIES)).default([]),
  speedTier: z.enum(SPEED_TIERS).default("medium"),
  costTier: z.enum(COST_TIERS).default("standard"),
  contextWindow: z.number().default(128000),
  inputCostPerM: z.number().default(0),
  outputCostPerM: z.number().default(0),
  supportsTools: z.boolean().default(false),
  supportsStructuredOutput: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsStreaming: z.boolean().default(false),
  supportsJsonMode: z.boolean().default(false),
  recommendedFor: z.array(z.string()).default([]),
  defaultTemperature: z.number().optional(),
  enabled: z.boolean().default(true),
  wired: z.boolean().default(false),
});
export type FlowmindModel = z.infer<typeof flowmindModelSchema>;

export type ModelConfig = FlowmindModel & {
  provider: ModelProviderId;
  capabilities: ModelCapability[];
  speed: SpeedTier;
  contextTokens: number;
  supportsStructured: boolean;
  supportsJson: boolean;
  useCases: string[];
};

export const DEFAULT_MODEL_ID =
  process.env.FLOWMIND_DEFAULT_REASONING_MODEL?.trim() || "claude-sonnet-4-6";
export const DEFAULT_FAST_MODEL_ID =
  process.env.FLOWMIND_DEFAULT_FAST_MODEL?.trim() || "claude-haiku-4-5-20251001";
export const DEFAULT_STRUCTURED_MODEL_ID =
  process.env.FLOWMIND_DEFAULT_STRUCTURED_MODEL?.trim() || "claude-sonnet-4-6";
export const DEFAULT_VISION_MODEL_ID =
  process.env.FLOWMIND_DEFAULT_VISION_MODEL?.trim() || "claude-sonnet-4-6";
export const DEFAULT_EVALUATOR_MODEL_ID =
  process.env.FLOWMIND_DEFAULT_EVALUATOR_MODEL?.trim() || "claude-opus-4-8";
export const FALLBACK_MODEL_ID = "claude-haiku-4-5-20251001";

export const MODEL_PROVIDERS: ModelProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models for judgment, writing, structured outputs, and agent work.",
    envKeyNames: ["ANTHROPIC_API_KEY"],
    docsUrl: "https://docs.anthropic.com/",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models for reasoning, multimodal work, and tool-heavy agents.",
    envKeyNames: ["OPENAI_API_KEY"],
    docsUrl: "https://platform.openai.com/docs",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsEmbeddings: true,
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models for long-context and multimodal analysis.",
    envKeyNames: ["GOOGLE_GENERATIVE_AI_API_KEY"],
    docsUrl: "https://ai.google.dev/",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
  },
  {
    id: "vercel_gateway",
    name: "Vercel AI Gateway",
    description: "Unified model routing and observability across providers.",
    envKeyNames: ["VERCEL_AI_GATEWAY_API_KEY"],
    docsUrl: "https://vercel.com/docs/ai-gateway",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Many hosted models behind one OpenAI-compatible endpoint.",
    envKeyNames: ["OPENROUTER_API_KEY"],
    docsUrl: "https://openrouter.ai/docs",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
  },
  {
    id: "groq",
    name: "Groq",
    description: "Very fast inference for lightweight routing and classification.",
    envKeyNames: ["GROQ_API_KEY"],
    docsUrl: "https://console.groq.com/docs",
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    description: "Fast hosted inference for open models.",
    envKeyNames: ["CEREBRAS_API_KEY"],
    docsUrl: "https://inference-docs.cerebras.ai/",
    supportsStructuredOutput: true,
    supportsStreaming: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "EU-friendly general models with tool and JSON support.",
    envKeyNames: ["MISTRAL_API_KEY"],
    docsUrl: "https://docs.mistral.ai/",
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
  },
  {
    id: "ollama",
    name: "Ollama / Local",
    description: "Local models for private or offline workflows.",
    envKeyNames: ["OLLAMA_BASE_URL"],
    baseUrl: "http://localhost:11434",
    docsUrl: "https://ollama.com/",
    supportsStreaming: true,
  },
  {
    id: "openai_compatible",
    name: "OpenAI-compatible",
    description: "Any custom endpoint that follows the OpenAI chat API shape.",
    envKeyNames: ["OPENAI_COMPATIBLE_API_KEY", "OPENAI_COMPATIBLE_BASE_URL"],
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
  },
  {
    id: "custom",
    name: "Custom",
    description: "Workspace-specific provider adapter.",
    envKeyNames: [],
  },
].map((p) => modelProviderConfigSchema.parse(p));

const RAW_MODELS: FlowmindModel[] = [
  {
    id: "claude-opus-4-8",
    providerId: "anthropic",
    modelId: "claude-opus-4-8",
    displayName: "Claude Opus 4.8",
    description: "Premium reasoning and synthesis for hard judgment calls.",
    capabilityTags: ["reasoning", "writing", "tool_calling", "vision", "structured_output", "coding", "evaluation", "premium"],
    speedTier: "slow",
    costTier: "expensive",
    contextWindow: 200000,
    inputCostPerM: 5,
    outputCostPerM: 25,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["hard reasoning", "synthesis", "judges", "final composer"],
    defaultTemperature: 0.35,
    wired: true,
  },
  {
    id: "claude-sonnet-4-6",
    providerId: "anthropic",
    modelId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    description: "Balanced default for most Flowmind agents.",
    capabilityTags: ["reasoning", "writing", "tool_calling", "vision", "structured_output", "coding", "summarization"],
    speedTier: "medium",
    costTier: "premium",
    contextWindow: 200000,
    inputCostPerM: 3,
    outputCostPerM: 15,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["default agent", "generation", "most nodes"],
    defaultTemperature: 0.45,
    wired: true,
  },
  {
    id: "claude-haiku-4-5-20251001",
    providerId: "anthropic",
    modelId: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku 4.5",
    description: "Fast/cheap model for classifiers, routers, and bulk crews.",
    capabilityTags: ["fast", "cheap", "classification", "routing", "structured_output", "tool_calling"],
    speedTier: "fast",
    costTier: "standard",
    contextWindow: 200000,
    inputCostPerM: 1,
    outputCostPerM: 5,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["classifiers", "routers", "high-volume crews", "cheap takes"],
    defaultTemperature: 0.25,
    wired: true,
  },
  {
    id: "gpt-5.1",
    providerId: "openai",
    modelId: "gpt-5.1",
    displayName: "GPT-5.1",
    description: "Frontier reasoning, coding, and tool use.",
    capabilityTags: ["reasoning", "tool_calling", "vision", "structured_output", "coding", "premium"],
    speedTier: "slow",
    costTier: "expensive",
    contextWindow: 256000,
    inputCostPerM: 5,
    outputCostPerM: 20,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["reasoning", "coding", "tool use"],
  },
  {
    id: "gpt-5-mini",
    providerId: "openai",
    modelId: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    description: "Fast OpenAI model for cheap classification and routing.",
    capabilityTags: ["fast", "cheap", "classification", "routing", "structured_output", "tool_calling"],
    speedTier: "fast",
    costTier: "cheap",
    contextWindow: 128000,
    inputCostPerM: 0.5,
    outputCostPerM: 2,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["cheap classification", "routing"],
  },
  {
    id: "gemini-2.5-pro",
    providerId: "google",
    modelId: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    description: "Long-context multimodal analysis.",
    capabilityTags: ["reasoning", "long_context", "vision", "structured_output", "tool_calling"],
    speedTier: "medium",
    costTier: "premium",
    contextWindow: 1000000,
    inputCostPerM: 2.5,
    outputCostPerM: 10,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["huge context", "document synthesis"],
  },
  {
    id: "gemini-2.5-flash",
    providerId: "google",
    modelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    description: "Fast long-context extraction and summarization.",
    capabilityTags: ["fast", "cheap", "long_context", "vision", "summarization", "structured_output"],
    speedTier: "fast",
    costTier: "cheap",
    contextWindow: 1000000,
    inputCostPerM: 0.3,
    outputCostPerM: 1.2,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["cheap long-context", "bulk extraction"],
  },
  {
    id: "llama-3.3-70b",
    providerId: "groq",
    modelId: "llama-3.3-70b",
    displayName: "Llama 3.3 70B (Groq)",
    description: "Very fast hosted open model for routing and simple JSON tasks.",
    capabilityTags: ["fast", "cheap", "routing", "classification", "structured_output"],
    speedTier: "very_fast",
    costTier: "cheap",
    contextWindow: 128000,
    inputCostPerM: 0.6,
    outputCostPerM: 0.8,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["ultra-fast routing", "real-time crews"],
  },
  {
    id: "mistral-large-latest",
    providerId: "mistral",
    modelId: "mistral-large-latest",
    displayName: "Mistral Large",
    description: "General model for EU-hosted workflows.",
    capabilityTags: ["reasoning", "tool_calling", "structured_output", "coding"],
    speedTier: "medium",
    costTier: "standard",
    contextWindow: 128000,
    inputCostPerM: 2,
    outputCostPerM: 6,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    recommendedFor: ["EU hosting", "general agent"],
  },
].map((m) => flowmindModelSchema.parse(m));

function compat(m: FlowmindModel): ModelConfig {
  return {
    ...m,
    provider: m.providerId,
    capabilities: m.capabilityTags,
    speed: m.speedTier,
    contextTokens: m.contextWindow,
    supportsStructured: m.supportsStructuredOutput,
    supportsJson: m.supportsJsonMode,
    useCases: m.recommendedFor,
  };
}

export const MODELS: ModelConfig[] = RAW_MODELS.map(compat);

export function getProvider(id: string): ModelProviderConfig | undefined {
  return MODEL_PROVIDERS.find((p) => p.id === id);
}

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id || m.modelId === id);
}

export function modelsByProvider(provider: Provider): ModelConfig[] {
  return MODELS.filter((m) => m.providerId === provider);
}

export function wiredModels(): ModelConfig[] {
  return MODELS.filter((m) => m.wired && m.enabled);
}

export function estimateModelCost(
  modelId: string,
  usage: { inputTokens?: number; outputTokens?: number },
): number | undefined {
  const m = getModel(modelId);
  if (!m || (!m.inputCostPerM && !m.outputCostPerM)) return undefined;
  return (
    ((usage.inputTokens ?? 0) / 1_000_000) * m.inputCostPerM +
    ((usage.outputTokens ?? 0) / 1_000_000) * m.outputCostPerM
  );
}

/** Rough run cost estimate in USD given token counts. */
export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  return estimateModelCost(modelId, { inputTokens, outputTokens }) ?? 0;
}
