import { pipelineSchema } from "@/lib/pipeline/schema";
import { getBillingAccount } from "@/lib/billing/usage";
import {
  estimateCreditsForRun,
  estimateCreditsForInputStudio,
  estimateCreditsForExport,
} from "@/lib/billing/credits";
import { canRunPipeline, canCreateDatasetRows, canExport } from "@/lib/billing/featureGates";
import type { CreditEstimate, FeatureGateResult } from "@/lib/billing/types";

export const runtime = "nodejs";

/** Estimate credits for an action and return the matching feature-gate decision. Deterministic;
 *  safe to call before any run/export. No writes, no secrets. */
export async function POST(req: Request) {
  let body: {
    kind?: "run" | "input_studio" | "export";
    pipeline?: unknown;
    onlyNodeId?: string;
    config?: { rowCount?: number; qualityTarget?: string; generationStyle?: string };
    modes?: string[];
    regenerateDocs?: boolean;
    githubPr?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const account = await getBillingAccount();
  let estimate: CreditEstimate;
  let gate: FeatureGateResult = { allowed: true };

  if (body.kind === "input_studio") {
    estimate = estimateCreditsForInputStudio(body.config ?? {});
    gate = canCreateDatasetRows(account, body.config?.rowCount ?? 20);
  } else if (body.kind === "export") {
    estimate = estimateCreditsForExport(body.modes ?? [], { regenerateDocs: body.regenerateDocs, githubPr: body.githubPr });
    gate = canExport(account, (body.modes ?? ["developer"])[0]);
  } else {
    const parsed = pipelineSchema.safeParse(body.pipeline);
    if (!parsed.success) return Response.json({ error: "Invalid pipeline" }, { status: 400 });
    estimate = estimateCreditsForRun(parsed.data, { onlyNodeId: body.onlyNodeId });
    gate = canRunPipeline(account, estimate);
  }

  return Response.json({
    estimate,
    gate,
    billingEnabled: account.billingEnabled,
    creditsAvailable: Math.round(account.balance.balance),
    planId: account.planId,
  });
}
