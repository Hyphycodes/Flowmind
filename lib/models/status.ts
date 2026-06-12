import { MODEL_PROVIDERS, MODELS, type ModelProviderConfig, type ModelProviderStatus } from "./providers";

export type ProviderStatus = {
  id: ModelProviderConfig["id"];
  name: string;
  status: ModelProviderStatus;
  missingEnvNames: string[];
  enabledModelsCount: number;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
};

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function statusForProvider(provider: ModelProviderConfig): ProviderStatus {
  const missingEnvNames = provider.envKeyNames.filter((name) => !hasEnv(name));
  const status: ModelProviderStatus = !provider.enabled
    ? "disabled"
    : missingEnvNames.length
      ? "missing_key"
      : "ready";
  return {
    id: provider.id,
    name: provider.name,
    status,
    missingEnvNames,
    enabledModelsCount: MODELS.filter((m) => m.providerId === provider.id && m.enabled).length,
    supportsToolCalling: provider.supportsToolCalling,
    supportsStructuredOutput: provider.supportsStructuredOutput,
    supportsVision: provider.supportsVision,
  };
}

export function providerStatuses(): ProviderStatus[] {
  return MODEL_PROVIDERS.map(statusForProvider);
}

export function isProviderReady(providerId: string): boolean {
  return providerStatuses().some((provider) => provider.id === providerId && provider.status === "ready");
}
