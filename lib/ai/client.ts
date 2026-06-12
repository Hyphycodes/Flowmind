import { anthropicModel } from "./anthropic";
import { getModel } from "@/lib/models/providers";
import { resolveModelSelection, type ResolvedModelSelection } from "@/lib/models/resolve";
import type { ModelSelection } from "@/lib/pipeline/schema";
import type { ModelRouterInput } from "@/lib/models/recommend";

export function getModelClient(modelId: string) {
  const model = getModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  if (model.providerId !== "anthropic") {
    throw new Error(`${model.displayName} is registry-ready but not wired for execution yet.`);
  }
  return anthropicModel(model.modelId);
}

export function resolveExecutionModel(
  selection: ModelSelection | undefined,
  context: ModelRouterInput,
  inherited?: ModelSelection,
): ResolvedModelSelection {
  return resolveModelSelection(selection, context, inherited);
}
