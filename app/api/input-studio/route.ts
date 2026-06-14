import { generateInputDataset } from "@/lib/datasets/inputStudio";
import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { getBillingAccount, logCreditEvent, incrementUsageCounter } from "@/lib/billing/usage";
import { estimateCreditsForInputStudio } from "@/lib/billing/credits";
import { canCreateDatasetRows } from "@/lib/billing/featureGates";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as any;
  const prompt = typeof b?.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: "Provide a prompt describing the dataset to generate." }, { status: 400 });
  }

  const rowCount = typeof b?.rowCount === "number" ? b.rowCount : 20;
  // Billing gate (no-op unless billing is enabled).
  const isEstimate = estimateCreditsForInputStudio({ rowCount, qualityTarget: b?.qualityTarget, generationStyle: b?.generationStyle });
  const account = await getBillingAccount();
  const gate = canCreateDatasetRows(account, rowCount);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason ?? "Input Studio limit reached", gate, estimate: isEstimate }, { status: 402 });
  }

  try {
    const dataset = await generateInputDataset({
      name: b?.name,
      prompt,
      columns: Array.isArray(b?.columns) ? b.columns : undefined,
      rowCount: typeof b?.rowCount === "number" ? b.rowCount : undefined,
      qualityTarget: b?.qualityTarget,
      generationStyle: b?.generationStyle,
      scenarioTags: Array.isArray(b?.scenarioTags) ? b.scenarioTags : undefined,
      requiredFields: Array.isArray(b?.requiredFields) ? b.requiredFields : undefined,
      examples: Array.isArray(b?.examples) ? b.examples : undefined,
      existingRows: Array.isArray(b?.existingRows) ? b.existingRows : undefined,
      datasetId: typeof b?.datasetId === "string" ? b.datasetId : undefined,
    });
    // Record credit spend + row usage (best-effort; no-op unless billing is enabled).
    const generatedRows = dataset.rows?.length ?? rowCount;
    void logCreditEvent({ eventType: "input_studio_generation", creditsDelta: -isEstimate.credits, metadata: { rows: generatedRows } });
    void incrementUsageCounter("inputStudioRows", generatedRows);
    return Response.json({ dataset, modelAvailable: hasAnthropicKey() });
  } catch (err) {
    return Response.json({ error: (err as Error)?.message ?? "Generation failed" }, { status: 500 });
  }
}
