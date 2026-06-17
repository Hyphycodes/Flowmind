import type {
  BillingAccount,
  CreditEstimate,
  FeatureGateResult,
  Limit,
  PlanFeature,
} from "./types";
import { getPlan, lowestPlanWithFeature, planHasFeature } from "./plans";

/** Central feature-gate system. Keep ALL plan/credit checks here — do not scatter plan logic
 *  across the app. Every gate returns a structured result the UI turns into a soft warning or an
 *  upgrade prompt. When billing is OFF, gates always allow (public demo stays unlimited). */

const ALLOW: FeatureGateResult = { allowed: true };

function isUnlimited(v: Limit | undefined): boolean {
  return v === "unlimited" || v === undefined;
}

function remaining(limit: Limit | undefined, used: number): number | "unlimited" {
  if (isUnlimited(limit)) return "unlimited";
  return Math.max(0, (limit as number) - used);
}

function upgradeCtaFor(feature: PlanFeature): { planRequired?: FeatureGateResult["planRequired"]; cta: string } {
  const plan = lowestPlanWithFeature(feature);
  return {
    planRequired: plan,
    cta: plan ? `Available in ${getPlan(plan).name}` : "Upgrade to unlock",
  };
}

/** Does the account's plan include a feature at all? */
export function canUseFeature(account: BillingAccount, feature: PlanFeature): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;
  if (planHasFeature(account.planId, feature)) return ALLOW;
  const { planRequired, cta } = upgradeCtaFor(feature);
  return {
    allowed: false,
    reason: `${feature.replace(/_/g, " ")} isn't included in your ${account.plan.name} plan.`,
    planRequired,
    upgradeCta: cta,
  };
}

/** Gate a real AI run by feature + monthly run limit + credit balance (+ soft warnings). */
export function canRunPipeline(account: BillingAccount, estimate: CreditEstimate): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;

  const feat = canUseFeature(account, "real_ai_runs");
  if (!feat.allowed) return feat;

  const runsUsed = account.counters.realRuns ?? 0;
  const runsLeft = remaining(account.plan.limits.realRunsPerMonth, runsUsed);
  if (runsLeft !== "unlimited" && runsLeft <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${account.plan.limits.realRunsPerMonth} live runs this month.`,
      planRequired: account.planId === "free" ? "pro" : "studio",
      upgradeCta: "Upgrade for more runs",
    };
  }

  const need = estimate.credits;
  const have = account.balance.balance;
  if (need > have) {
    return {
      allowed: false,
      reason: "You're out of live AI credits.",
      creditsRequired: need,
      creditsAvailable: have,
      planRequired: account.planId === "free" ? "pro" : "studio",
      upgradeCta: "Upgrade or add credits to keep running live AI",
    };
  }

  // Allowed — surface soft warnings for heavy runs / nearing balance.
  const softs: string[] = [...(estimate.warnings ?? [])];
  if (have - need < account.plan.includedCredits * 0.1) softs.push("You're nearing your credit limit.");
  return { allowed: true, creditsRequired: need, creditsAvailable: have, softWarning: softs[0] };
}

/**
 * Gate an AI design call — a chat edit, a remix move, or a from-scratch generation (Prompt 20).
 * This is the EDITS pool, independent of RUNS: different cost shape, separate limit + upgrade lever.
 * `kind` only tweaks the message ("edit" vs "generate"); both decrement the same `edits` counter.
 */
export function canEditPipeline(account: BillingAccount, kind: "edit" | "generate" = "edit"): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;

  const feat = canUseFeature(account, "real_ai_runs");
  if (!feat.allowed) return feat;

  const used = account.counters.edits ?? 0;
  const left = remaining(account.plan.limits.editsPerMonth, used);
  if (left !== "unlimited" && left <= 0) {
    const noun = kind === "generate" ? "generations" : "AI edits";
    return {
      allowed: false,
      reason: `You've used all ${account.plan.limits.editsPerMonth} ${noun} this month.`,
      planRequired: account.planId === "free" ? "pro" : "studio",
      upgradeCta: "Upgrade for more edits",
    };
  }
  const soft = left !== "unlimited" && left <= 3 ? `Only ${left} AI edit${left === 1 ? "" : "s"} left this month.` : undefined;
  return { allowed: true, softWarning: soft };
}

/** Remaining count for a pool, for the UI meters. */
export function remainingRuns(account: BillingAccount): number | "unlimited" {
  return remaining(account.plan.limits.realRunsPerMonth, account.counters.realRuns ?? 0);
}
export function remainingEdits(account: BillingAccount): number | "unlimited" {
  return remaining(account.plan.limits.editsPerMonth, account.counters.edits ?? 0);
}

export function canCreateDatasetRows(account: BillingAccount, rowCount: number): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;
  const feat = canUseFeature(account, "input_studio");
  if (!feat.allowed) return feat;
  const used = account.counters.inputStudioRows ?? 0;
  const left = remaining(account.plan.limits.inputStudioRowsPerMonth, used);
  if (left !== "unlimited" && rowCount > left) {
    return {
      allowed: false,
      reason: `That would exceed your ${account.plan.limits.inputStudioRowsPerMonth} Input Studio rows/month (${left} left).`,
      planRequired: account.planId === "free" ? "pro" : "studio",
      upgradeCta: "Upgrade for more Input Studio rows",
    };
  }
  return { allowed: true, softWarning: left !== "unlimited" && rowCount > left * 0.8 ? "This uses most of your monthly Input Studio rows." : undefined };
}

const EXPORT_FEATURE: Record<string, PlanFeature> = {
  developer: "developer_export",
  client_blueprint: "client_blueprint",
  founder_brief: "founder_brief",
  runtime: "developer_export",
  api: "developer_export",
};

export function canExport(account: BillingAccount, exportMode: string): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;
  const feature = EXPORT_FEATURE[exportMode] ?? "developer_export";
  const feat = canUseFeature(account, feature);
  if (!feat.allowed) return feat;
  const used = account.counters.exports ?? 0;
  const left = remaining(account.plan.limits.exportsPerMonth, used);
  if (left !== "unlimited" && left <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${account.plan.limits.exportsPerMonth} exports this month.`,
      planRequired: account.planId === "free" ? "pro" : "studio",
      upgradeCta: "Upgrade for more exports",
    };
  }
  return ALLOW;
}

export function canCreateGitHubPr(account: BillingAccount): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;
  const feat = canUseFeature(account, "github_pr_export");
  if (!feat.allowed) {
    return { ...feat, softWarning: "You can still download the ZIP export." };
  }
  const used = account.counters.githubPrExports ?? 0;
  const left = remaining(account.plan.limits.githubPrExportsPerMonth, used);
  if (left !== "unlimited" && left <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${account.plan.limits.githubPrExportsPerMonth} GitHub PR exports this month.`,
      planRequired: "studio",
      upgradeCta: "Upgrade for more GitHub PR exports",
      softWarning: "You can still download the ZIP export.",
    };
  }
  return ALLOW;
}

export function canSavePipeline(account: BillingAccount, currentCount: number): FeatureGateResult {
  if (!account.billingEnabled) return ALLOW;
  const left = remaining(account.plan.limits.savedPipelines, currentCount);
  if (left !== "unlimited" && left <= 0) {
    return {
      allowed: false,
      reason: `Your ${account.plan.name} plan saves up to ${account.plan.limits.savedPipelines} pipelines.`,
      planRequired: account.planId === "free" ? "pro" : "studio",
      upgradeCta: "Upgrade to save more pipelines",
    };
  }
  return ALLOW;
}
