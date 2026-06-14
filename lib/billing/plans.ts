import type { PlanConfig, PlanFeature, PlanId } from "./types";

/** Config-driven plan catalog. Prices + Stripe price IDs come from env so nothing is hardcoded
 *  to a single Stripe account. Limits/features are the source of truth for feature gates. */

const PRICE = {
  proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  proYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  studioMonthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
  studioYearly: process.env.STRIPE_PRICE_STUDIO_YEARLY,
};

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Discovery and demos. Explore the canvas, run limited live AI, export a few times.",
    includedCredits: 200,
    monthlyPriceCents: 0,
    isPublic: true,
    features: ["templates", "real_ai_runs", "input_studio", "developer_export"],
    limits: {
      savedPipelines: 3,
      realRunsPerMonth: 25,
      inputStudioRowsPerMonth: 200,
      exportsPerMonth: 5,
      githubPrExportsPerMonth: 0,
      connectedAccounts: 1,
      datasetRowsStored: 2000,
      takesPerPipeline: 5,
      teamMembers: 1,
      maxTeamNodesPerPipeline: 6,
      maxAgentsPerTeam: 6,
      maxRunTraceRetentionDays: 14,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For solo builders. More credits, exports, GitHub PR export, Drive connector.",
    includedCredits: 5000,
    monthlyPriceCents: 2900,
    yearlyPriceCents: 29000,
    stripePriceIdMonthly: PRICE.proMonthly,
    stripePriceIdYearly: PRICE.proYearly,
    isPublic: true,
    features: [
      "templates",
      "real_ai_runs",
      "input_studio",
      "developer_export",
      "client_blueprint",
      "founder_brief",
      "github_pr_export",
      "google_drive_connector",
      "advanced_evals",
    ],
    limits: {
      savedPipelines: 50,
      realRunsPerMonth: 1000,
      inputStudioRowsPerMonth: 10000,
      exportsPerMonth: 100,
      githubPrExportsPerMonth: 50,
      connectedAccounts: 5,
      datasetRowsStored: 100000,
      takesPerPipeline: 50,
      teamMembers: 1,
      maxTeamNodesPerPipeline: "unlimited",
      maxAgentsPerTeam: 12,
      maxRunTraceRetentionDays: 90,
    },
  },
  studio: {
    id: "studio",
    name: "Studio",
    description: "For agencies and small teams. Workspace, shared packs, branded client exports.",
    includedCredits: 20000,
    monthlyPriceCents: 9900,
    yearlyPriceCents: 99000,
    stripePriceIdMonthly: PRICE.studioMonthly,
    stripePriceIdYearly: PRICE.studioYearly,
    isPublic: true,
    features: [
      "templates",
      "real_ai_runs",
      "input_studio",
      "developer_export",
      "client_blueprint",
      "founder_brief",
      "github_pr_export",
      "google_drive_connector",
      "advanced_evals",
      "team_workspace",
      "branded_exports",
      "private_template_library",
    ],
    limits: {
      savedPipelines: "unlimited",
      realRunsPerMonth: 5000,
      inputStudioRowsPerMonth: 100000,
      exportsPerMonth: "unlimited",
      githubPrExportsPerMonth: 500,
      connectedAccounts: "unlimited",
      datasetRowsStored: 1000000,
      takesPerPipeline: "unlimited",
      teamMembers: 8,
      maxTeamNodesPerPipeline: "unlimited",
      maxAgentsPerTeam: "unlimited",
      maxRunTraceRetentionDays: 365,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom limits, SSO, BYOK / private model routing, self-host, audit logs.",
    includedCredits: 100000,
    isPublic: true, // shown as "contact" — no self-serve checkout
    features: [
      "templates",
      "real_ai_runs",
      "input_studio",
      "developer_export",
      "client_blueprint",
      "founder_brief",
      "github_pr_export",
      "google_drive_connector",
      "advanced_evals",
      "team_workspace",
      "branded_exports",
      "private_template_library",
      "byok",
      "priority_support",
      "self_hosting",
    ],
    limits: {
      savedPipelines: "unlimited",
      realRunsPerMonth: "unlimited",
      inputStudioRowsPerMonth: "unlimited",
      exportsPerMonth: "unlimited",
      githubPrExportsPerMonth: "unlimited",
      connectedAccounts: "unlimited",
      datasetRowsStored: "unlimited",
      takesPerPipeline: "unlimited",
      teamMembers: 1000,
      maxTeamNodesPerPipeline: "unlimited",
      maxAgentsPerTeam: "unlimited",
      maxRunTraceRetentionDays: 3650,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "studio", "enterprise"];

export function getPlan(id: PlanId | string | null | undefined): PlanConfig {
  return PLANS[(id as PlanId) ?? "free"] ?? PLANS.free;
}

export function planHasFeature(planId: PlanId, feature: PlanFeature): boolean {
  return getPlan(planId).features.includes(feature);
}

/** Lowest plan that includes a feature (for "available in Pro" upgrade prompts). */
export function lowestPlanWithFeature(feature: PlanFeature): PlanId | undefined {
  return PLAN_ORDER.find((id) => getPlan(id).features.includes(feature));
}

/** Whether a plan can self-serve checkout (has a configured monthly price id). */
export function planIsPurchasable(planId: PlanId): boolean {
  const p = getPlan(planId);
  return Boolean(p.stripePriceIdMonthly);
}
