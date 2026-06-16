import { z } from "zod";

/** Audit & Governance (Task 07b). An immutable audit log, server-enforced spend budgets, and
 *  opt-in approval gates on costly/irreversible actions. Default off so a solo user isn't slowed;
 *  the artifact a company's security team asks to see. Config-gated like workspaces. */

export const GATED_ACTIONS = ["deep_run", "export", "public_link", "pricing"] as const;
export type GatedAction = (typeof GATED_ACTIONS)[number];

export const GATED_ACTION_LABEL: Record<GatedAction, string> = {
  deep_run: "Expensive runs (above the cost threshold)",
  export: "Generating an export",
  public_link: "Creating a public link share",
  pricing: "Attaching pricing to a Run-App",
};

export const auditEntrySchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullish(),
  actorUserId: z.string().nullish(),
  action: z.string(),
  targetType: z.string().nullish(),
  targetId: z.string().nullish(),
  summary: z.string().nullish(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const governanceConfigSchema = z.object({
  workspaceId: z.string(),
  auditEnabled: z.boolean().default(true),
  monthlyBudgetUsd: z.number().nullish(),
  requireApproval: z.array(z.enum(GATED_ACTIONS)).default([]),
  approvalCostThresholdUsd: z.number().default(1),
});
export type GovernanceConfig = z.infer<typeof governanceConfigSchema>;

export function emptyGovernance(workspaceId: string): GovernanceConfig {
  return governanceConfigSchema.parse({ workspaceId });
}

export const approvalRequestSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullish(),
  requesterUserId: z.string().nullish(),
  action: z.string(),
  targetId: z.string().nullish(),
  reason: z.string().nullish(),
  estimatedCostUsd: z.number().nullish(),
  status: z.enum(["pending", "approved", "denied"]).default("pending"),
  decidedBy: z.string().nullish(),
  decidedAt: z.string().nullish(),
  createdAt: z.string(),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
