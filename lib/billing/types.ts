/** Billing, credits, usage & plans (Prompt 11). Credits are the user-facing abstraction; we
 *  never invent exact provider dollar costs. All types are additive and degrade gracefully —
 *  when billing is OFF (`billingEnabled() === false`) the app behaves as unlimited/free. */

export type PlanId = "free" | "pro" | "studio" | "enterprise";

export type PlanFeature =
  | "templates"
  | "real_ai_runs"
  | "input_studio"
  | "developer_export"
  | "client_blueprint"
  | "founder_brief"
  | "github_pr_export"
  | "google_drive_connector"
  | "team_workspace"
  | "branded_exports"
  | "private_template_library"
  | "byok"
  | "advanced_evals"
  | "priority_support"
  | "self_hosting";

export type Limit = number | "unlimited";

export type PlanLimits = {
  savedPipelines: Limit;
  realRunsPerMonth: Limit;
  /** Prompt 20: AI design calls (chat edits, remix moves, from-scratch generation) per month —
   *  a separate pool from runs because the cost shape differs (one call vs. a whole pipeline run). */
  editsPerMonth: Limit;
  inputStudioRowsPerMonth: Limit;
  exportsPerMonth: Limit;
  githubPrExportsPerMonth: Limit;
  connectedAccounts: Limit;
  datasetRowsStored: Limit;
  takesPerPipeline: Limit;
  teamMembers: number;
  maxTeamNodesPerPipeline?: Limit;
  maxAgentsPerTeam?: Limit;
  maxRunTraceRetentionDays?: number;
};

export type PlanConfig = {
  id: PlanId;
  name: string;
  description: string;
  monthlyPriceCents?: number;
  yearlyPriceCents?: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  includedCredits: number;
  limits: PlanLimits;
  features: PlanFeature[];
  isPublic: boolean;
};

/** A coarse, deterministic dollar estimate (credits are what users actually see). */
export type CostEstimate = {
  inputTokens?: number;
  outputTokens?: number;
  usd?: number;
};

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type CreditEventType =
  | "pipeline_generation"
  | "team_run"
  | "agent_run"
  | "input_studio_generation"
  | "product_drop_generation"
  | "remix"
  | "eval_run"
  | "export_generation"
  | "github_pr_export"
  | "tool_call"
  | "manual_adjustment"
  | "monthly_grant"
  | "credit_purchase";

export type CreditEvent = {
  id: string;
  userId: string;
  workspaceId?: string;
  pipelineId?: string;
  runId?: string;
  takeId?: string;
  eventType: CreditEventType;
  creditsDelta: number; // negative for spend, positive for grant/purchase
  modelCostEstimate?: CostEstimate;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type CreditBalance = {
  userId: string;
  workspaceId?: string;
  balance: number;
  monthlyGrantRemaining: number;
  purchasedCreditsRemaining: number;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
};

export type CreditEstimateLine = {
  label: string;
  credits: number;
  reason?: string;
  nodeId?: string;
  teamId?: string;
  agentId?: string;
};

export type CreditEstimate = {
  credits: number;
  breakdown: CreditEstimateLine[];
  warnings?: string[];
};

export type UsageEvent = {
  id: string;
  userId: string;
  workspaceId?: string;
  type: string;
  pipelineId?: string;
  nodeId?: string;
  teamId?: string;
  agentId?: string;
  providerId?: string;
  modelId?: string;
  toolId?: string;
  creditsUsed?: number;
  tokenUsage?: TokenUsage;
  costEstimate?: CostEstimate;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

/** Per-period usage counters (keyed names match the meter + gate checks). */
export type UsageCounters = {
  realRuns?: number;
  /** Prompt 20: AI design calls used this period (edits + remix + generation). */
  edits?: number;
  inputStudioRows?: number;
  exports?: number;
  githubPrExports?: number;
  creditsSpent?: number;
  [key: string]: number | undefined;
};

export type FeatureGateResult = {
  allowed: boolean;
  reason?: string;
  planRequired?: PlanId;
  creditsRequired?: number;
  creditsAvailable?: number;
  upgradeCta?: string;
  softWarning?: string;
};

/** Everything a gate / meter needs about the current account. Built server-side; the sanitized
 *  shape is also returned to the client (never tokens / Stripe secrets). */
export type BillingAccount = {
  planId: PlanId;
  plan: PlanConfig;
  status: string; // subscription status, or "none"
  billingEnabled: boolean;
  stripeConfigured: boolean;
  balance: CreditBalance;
  counters: UsageCounters;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd?: boolean;
};

export type UserModelKey = {
  id: string;
  userId: string;
  workspaceId?: string;
  providerId: string;
  label: string;
  encryptedKeyRef: string;
  status: "active" | "invalid" | "revoked";
  createdAt: string;
  updatedAt: string;
};
