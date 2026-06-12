import { z } from "zod";

/** Model provider abstraction. Flowmind is provider-agnostic — Claude is wired today,
 *  the rest are registry-ready (capability metadata) for per-node/per-agent model picking
 *  and recommendations. `wired: true` means the provider can actually execute now. */

export const PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "groq",
  "cerebras",
  "mistral",
  "openrouter",
  "vercel",
  "ollama",
] as const;
export type Provider = (typeof PROVIDERS)[number];

export const CAPABILITIES = [
  "reasoning",
  "speed",
  "cheap",
  "structured",
  "json",
  "tools",
  "vision",
  "long-context",
  "writing",
  "coding",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const SPEED_TIERS = ["frontier", "balanced", "fast", "instant"] as const;
export type SpeedTier = (typeof SPEED_TIERS)[number];

export const modelConfigSchema = z.object({
  id: z.string(),
  provider: z.enum(PROVIDERS),
  displayName: z.string(),
  capabilities: z.array(z.enum(CAPABILITIES)).default([]),
  speed: z.enum(SPEED_TIERS).default("balanced"),
  contextTokens: z.number().default(128000),
  inputCostPerM: z.number().default(0),
  outputCostPerM: z.number().default(0),
  supportsTools: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsStructured: z.boolean().default(false),
  supportsJson: z.boolean().default(false),
  useCases: z.array(z.string()).default([]),
  wired: z.boolean().default(false),
});
export type ModelConfig = z.infer<typeof modelConfigSchema>;

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";
export const FALLBACK_MODEL_ID = "claude-haiku-4-5-20251001";

export const MODELS: ModelConfig[] = [
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    displayName: "Claude Opus 4.8",
    capabilities: ["reasoning", "tools", "vision", "structured", "json", "writing", "coding"],
    speed: "frontier",
    contextTokens: 200000,
    inputCostPerM: 5,
    outputCostPerM: 25,
    supportsTools: true,
    supportsVision: true,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["hard reasoning", "synthesis", "judges", "final composer"],
    wired: true,
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    capabilities: ["reasoning", "tools", "vision", "structured", "json", "writing", "coding"],
    speed: "balanced",
    contextTokens: 200000,
    inputCostPerM: 3,
    outputCostPerM: 15,
    supportsTools: true,
    supportsVision: true,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["default agent", "generation", "most nodes"],
    wired: true,
  },
  {
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    capabilities: ["speed", "cheap", "tools", "structured", "json"],
    speed: "fast",
    contextTokens: 200000,
    inputCostPerM: 1,
    outputCostPerM: 5,
    supportsTools: true,
    supportsVision: true,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["classifiers", "routers", "high-volume crews", "cheap takes"],
    wired: true,
  },
  {
    id: "gpt-5.1",
    provider: "openai",
    displayName: "GPT-5.1",
    capabilities: ["reasoning", "tools", "vision", "structured", "json", "coding"],
    speed: "frontier",
    contextTokens: 256000,
    inputCostPerM: 5,
    outputCostPerM: 20,
    supportsTools: true,
    supportsVision: true,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["reasoning", "coding", "tool use"],
    wired: false,
  },
  {
    id: "gpt-5-mini",
    provider: "openai",
    displayName: "GPT-5 Mini",
    capabilities: ["speed", "cheap", "tools", "structured", "json"],
    speed: "fast",
    contextTokens: 128000,
    inputCostPerM: 0.5,
    outputCostPerM: 2,
    supportsTools: true,
    supportsVision: false,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["cheap classification", "routing"],
    wired: false,
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    displayName: "Gemini 2.5 Pro",
    capabilities: ["reasoning", "long-context", "vision", "structured", "json", "tools"],
    speed: "balanced",
    contextTokens: 1000000,
    inputCostPerM: 2.5,
    outputCostPerM: 10,
    supportsTools: true,
    supportsVision: true,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["huge context", "document synthesis"],
    wired: false,
  },
  {
    id: "gemini-2.5-flash",
    provider: "google",
    displayName: "Gemini 2.5 Flash",
    capabilities: ["speed", "cheap", "long-context", "vision", "json"],
    speed: "fast",
    contextTokens: 1000000,
    inputCostPerM: 0.3,
    outputCostPerM: 1.2,
    supportsTools: true,
    supportsVision: true,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["cheap long-context", "bulk extraction"],
    wired: false,
  },
  {
    id: "llama-3.3-70b",
    provider: "groq",
    displayName: "Llama 3.3 70B (Groq)",
    capabilities: ["speed", "cheap", "json", "tools"],
    speed: "instant",
    contextTokens: 128000,
    inputCostPerM: 0.6,
    outputCostPerM: 0.8,
    supportsTools: true,
    supportsVision: false,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["ultra-fast routing", "real-time crews"],
    wired: false,
  },
  {
    id: "mistral-large-latest",
    provider: "mistral",
    displayName: "Mistral Large",
    capabilities: ["reasoning", "tools", "structured", "json", "coding"],
    speed: "balanced",
    contextTokens: 128000,
    inputCostPerM: 2,
    outputCostPerM: 6,
    supportsTools: true,
    supportsVision: false,
    supportsStructured: true,
    supportsJson: true,
    useCases: ["EU hosting", "general agent"],
    wired: false,
  },
];

export function getModel(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsByProvider(provider: Provider): ModelConfig[] {
  return MODELS.filter((m) => m.provider === provider);
}

export function wiredModels(): ModelConfig[] {
  return MODELS.filter((m) => m.wired);
}

/** Rough run cost estimate in USD given token counts. */
export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const m = getModel(modelId);
  if (!m) return 0;
  return (inputTokens / 1_000_000) * m.inputCostPerM + (outputTokens / 1_000_000) * m.outputCostPerM;
}
