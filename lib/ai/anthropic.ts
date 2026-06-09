import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic";

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

let _provider: AnthropicProvider | null = null;

/** A configured Anthropic model for the AI SDK. Server-side only. */
export function anthropicModel(modelId?: string) {
  if (!_provider) {
    _provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _provider(modelId?.trim() || DEFAULT_MODEL);
}
