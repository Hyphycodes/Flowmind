import { MODELS } from "@/lib/models/providers";
import { providerStatuses } from "@/lib/models/status";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    providers: providerStatuses(),
    models: MODELS.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      displayName: model.displayName,
      capabilityTags: model.capabilityTags,
      speedTier: model.speedTier,
      costTier: model.costTier,
      supportsTools: model.supportsTools,
      supportsStructuredOutput: model.supportsStructuredOutput,
      supportsVision: model.supportsVision,
      wired: model.wired,
      enabled: model.enabled,
    })),
  });
}
