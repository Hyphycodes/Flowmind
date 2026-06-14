import type { Pipeline, PipelineNode } from "@/lib/pipeline/schema";
import { getModel } from "@/lib/models/providers";
import type { CostEstimate, CreditEstimate, CreditEstimateLine } from "./types";

/** Deterministic, config-driven credit calculation. We do NOT rely only on provider $ cost —
 *  credits are derived from model calls × cost tier, agent counts, rows, tools, and exports.
 *  Credits are the user-facing abstraction; numbers are intentionally simple + tunable. */

/** Credits per single model call, by the model's cost tier. */
export const CREDIT_COST = {
  modelCallByTier: { cheap: 1, standard: 2, premium: 4, expensive: 5 } as Record<string, number>,
  perToolCall: 1,
  perInputStudioRow: 0.2,
  perInputStudioRowPremium: 0.4,
  exportDocsBase: 8, // when AI-generated docs are (re)generated
  githubPrExport: 2,
  productDrop: 3,
  remix: 3,
  evalRun: 1,
  pipelineGeneration: 5,
};

/** Soft thresholds → warnings (not hard blocks). */
export const SOFT = {
  heavyRunCredits: 40,
  manyAgents: 16,
};

function modelCreditCost(modelId: string | undefined): number {
  const tier = modelId ? getModel(modelId)?.costTier : undefined;
  return CREDIT_COST.modelCallByTier[tier ?? "standard"] ?? 2;
}

function activeAgentCount(node: PipelineNode): number {
  if (!node.team) return 1;
  const agents = node.team.agents.filter((a) => !a.muted);
  return Math.max(agents.length, 1);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Estimate credits to run a pipeline once (full run). Mirrors what the run engine will do. */
export function estimateCreditsForRun(
  pipeline: Pipeline,
  opts: { onlyNodeId?: string } = {},
): CreditEstimate {
  const nodes = opts.onlyNodeId
    ? pipeline.nodes.filter((n) => n.id === opts.onlyNodeId)
    : pipeline.nodes;
  const breakdown: CreditEstimateLine[] = [];
  const warnings: string[] = [];
  let totalAgents = 0;

  for (const node of nodes) {
    if (node.type === "input") continue; // loading inputs is free
    const agents = activeAgentCount(node);
    totalAgents += agents;
    const modelId = node.team?.lead ? node.model : node.model;
    const perCall = modelCreditCost(modelId);
    const credits = perCall * agents;
    breakdown.push({
      label: node.team ? `${node.title} (${agents} agents)` : node.title,
      credits,
      reason: `${agents} model call(s) × ${perCall} (${getModel(modelId)?.costTier ?? "standard"})`,
      nodeId: node.id,
      teamId: node.team ? node.id : undefined,
    });

    // Tool calls (source tool + attachments) add a little.
    const toolCount =
      (node.source?.toolId ? 1 : 0) + (node.toolAttachments?.length ?? 0) + (node.team?.toolAttachments?.length ?? 0);
    if (toolCount > 0) {
      breakdown.push({
        label: `${node.title} — ${toolCount} tool call(s)`,
        credits: toolCount * CREDIT_COST.perToolCall,
        reason: "External tool / API calls",
        nodeId: node.id,
      });
    }
  }

  const credits = round1(breakdown.reduce((s, b) => s + b.credits, 0));
  if (credits >= SOFT.heavyRunCredits) warnings.push(`This run is heavier than usual: ${credits} credits.`);
  if (totalAgents >= SOFT.manyAgents) warnings.push(`Executes ${totalAgents} agents — consider muting some or using faster models.`);

  return { credits, breakdown, warnings: warnings.length ? warnings : undefined };
}

export function estimateCreditsForInputStudio(config: {
  rowCount?: number;
  qualityTarget?: string;
  generationStyle?: string;
}): CreditEstimate {
  const rows = Math.max(config.rowCount ?? 20, 1);
  const premium = config.qualityTarget === "high" || config.generationStyle === "premium";
  const per = premium ? CREDIT_COST.perInputStudioRowPremium : CREDIT_COST.perInputStudioRow;
  const credits = round1(rows * per);
  return {
    credits,
    breakdown: [
      {
        label: `Generate ${rows} rows`,
        credits,
        reason: `${per} credit/row${premium ? " (premium)" : ""}`,
      },
    ],
  };
}

export function estimateCreditsForExport(
  exportModes: string[],
  ctx: { regenerateDocs?: boolean; githubPr?: boolean } = {},
): CreditEstimate {
  const breakdown: CreditEstimateLine[] = [];
  // Plain developer/runtime ZIP files are deterministic = free; AI doc regeneration costs.
  const aiDocModes = exportModes.filter((m) => m === "client_blueprint" || m === "founder_brief");
  if (ctx.regenerateDocs && aiDocModes.length) {
    breakdown.push({
      label: `Regenerate ${aiDocModes.length} AI doc(s)`,
      credits: aiDocModes.length * CREDIT_COST.exportDocsBase,
      reason: "AI-written client/founder docs",
    });
  }
  if (ctx.githubPr) {
    breakdown.push({ label: "GitHub PR export", credits: CREDIT_COST.githubPrExport, reason: "Branch + PR + description" });
  }
  const credits = round1(breakdown.reduce((s, b) => s + b.credits, 0));
  return { credits, breakdown };
}

/** Convert a recorded cost trace (token usage) into credits when usage is known; otherwise fall
 *  back to a small per-call estimate. Never invents exact dollar costs. */
export function creditsFromCostEstimate(modelId: string | undefined, cost?: CostEstimate): number {
  if (cost?.inputTokens != null || cost?.outputTokens != null) {
    const tokens = (cost.inputTokens ?? 0) + (cost.outputTokens ?? 0);
    // ~1 credit per ~6k tokens, weighted by tier — coarse + deterministic.
    const tierMult = modelCreditCost(modelId) / 2;
    return round1(Math.max(1, (tokens / 6000) * tierMult));
  }
  return modelCreditCost(modelId);
}
