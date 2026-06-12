import type { ModelSelection } from "@/lib/pipeline/schema";
import { getModel, DEFAULT_MODEL_ID, FALLBACK_MODEL_ID, type ModelConfig } from "./providers";
import { recommendModelForNode, type ModelRouterInput } from "./recommend";
import { isProviderReady } from "./status";

export type ResolvedModelSelection = {
  selectedModelId: string;
  selectedModel?: ModelConfig;
  fallbackModelIds: string[];
  mode: ModelSelection["mode"];
  reason: string;
  ready: boolean;
  warnings: string[];
};

export function resolveModelSelection(
  selection: ModelSelection | undefined,
  context: ModelRouterInput,
  inherited?: ModelSelection,
): ResolvedModelSelection {
  const effective = selection?.mode === "inherit" ? inherited : selection;
  const rec = recommendModelForNode(context);
  const selectedModelId =
    effective?.mode === "manual" && effective.primaryModelId
      ? effective.primaryModelId
      : effective?.mode === "fallback_chain" && effective.primaryModelId
        ? effective.primaryModelId
        : rec.recommendedModelId || DEFAULT_MODEL_ID;
  const model = getModel(selectedModelId);
  const fallbackModelIds =
    effective?.fallbackModelIds?.length ? effective.fallbackModelIds : rec.fallbackModelIds;
  const ready = model ? model.wired && isProviderReady(model.providerId) : false;
  const warnings = [
    ...rec.warnings,
    ...(model && !model.wired ? [`${model.displayName} is not wired for execution yet.`] : []),
    ...(model && !ready ? [`${model.displayName} is not ready; Flowmind can use ${FALLBACK_MODEL_ID} or seeded fallbacks.`] : []),
  ];

  return {
    selectedModelId,
    selectedModel: model,
    fallbackModelIds,
    mode: effective?.mode ?? selection?.mode ?? "auto",
    reason: effective?.reason || rec.reason,
    ready,
    warnings,
  };
}
