import { getServerSupabase } from "@/lib/supabase/server";
import { newId } from "@/lib/pipeline/validate";
import { governanceConfigSchema, type GatedAction, type GovernanceConfig } from "./schema";

/** Server-side governance enforcement (Task 07b). Budgets + approval gates are enforced HERE, never
 *  in the UI. Everything no-ops when there's no workspace (the demo) or no governance config — so a
 *  solo user is never slowed. */

export async function getPipelineWorkspace(pipelineId: string): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data } = await sb.from("pipelines").select("workspace_id").eq("id", pipelineId).maybeSingle();
  return (data as { workspace_id?: string | null } | null)?.workspace_id ?? null;
}

export async function getGovernance(workspaceId: string | null): Promise<GovernanceConfig | null> {
  if (!workspaceId) return null;
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data } = await sb.from("workspace_governance").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  try {
    return governanceConfigSchema.parse({
      workspaceId,
      auditEnabled: r.audit_enabled ?? true,
      monthlyBudgetUsd: (r.monthly_budget_usd as number | null) ?? undefined,
      requireApproval: r.require_approval ?? [],
      approvalCostThresholdUsd: (r.approval_cost_threshold_usd as number | null) ?? 1,
    });
  } catch {
    return null;
  }
}

/** Month-to-date spend (USD) for a workspace, summed from run trace costs. */
export async function monthSpendUsd(workspaceId: string): Promise<number> {
  const sb = getServerSupabase();
  if (!sb) return 0;
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const { data } = await sb.from("runs").select("trace,created_at").eq("workspace_id", workspaceId).gte("created_at", since.toISOString());
  let sum = 0;
  for (const r of (data as { trace?: { costUsd?: number } | null }[]) ?? []) sum += r.trace?.costUsd ?? 0;
  return sum;
}

export async function hasApproval(workspaceId: string, action: GatedAction, targetId: string): Promise<boolean> {
  const sb = getServerSupabase();
  if (!sb) return false;
  const { data } = await sb
    .from("approval_requests")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("action", action)
    .eq("target_id", targetId)
    .eq("status", "approved")
    .limit(1);
  return ((data as unknown[]) ?? []).length > 0;
}

export async function createApprovalRequest(input: {
  workspaceId: string;
  requesterUserId?: string | null;
  action: GatedAction;
  targetId: string;
  reason?: string;
  estimatedCostUsd?: number;
}): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  // Don't pile up duplicate pending requests for the same action+target.
  const { data: existing } = await sb
    .from("approval_requests")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("action", input.action)
    .eq("target_id", input.targetId)
    .eq("status", "pending")
    .limit(1);
  if (((existing as unknown[]) ?? []).length) return;
  await sb.from("approval_requests").insert({
    id: newId("apr"),
    workspace_id: input.workspaceId,
    requester_user_id: input.requesterUserId ?? null,
    action: input.action,
    target_id: input.targetId,
    reason: input.reason ?? null,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
    status: "pending",
    created_at: new Date().toISOString(),
  });
}

export type RunGate = { allowed: boolean; reason?: string; warn?: string; needsApproval?: boolean };

/** Budget + approval gate for a run. Returns allowed:true (a no-op) when there's no workspace or
 *  no governance configured. Blocks when over budget, or when an expensive run needs approval. */
export async function checkRunGovernance(opts: {
  pipelineId: string;
  estimatedUsd: number;
  actorUserId?: string | null;
}): Promise<RunGate> {
  const workspaceId = await getPipelineWorkspace(opts.pipelineId);
  if (!workspaceId) return { allowed: true };
  const gov = await getGovernance(workspaceId);
  if (!gov) return { allowed: true };

  let warn: string | undefined;
  if (gov.monthlyBudgetUsd != null) {
    const spent = await monthSpendUsd(workspaceId);
    if (spent >= gov.monthlyBudgetUsd) {
      return { allowed: false, reason: `Workspace monthly budget of $${gov.monthlyBudgetUsd} reached ($${spent.toFixed(2)} spent).` };
    }
    if (spent >= gov.monthlyBudgetUsd * 0.8) {
      warn = `${Math.round((spent / gov.monthlyBudgetUsd) * 100)}% of the monthly budget used.`;
    }
  }

  if (gov.requireApproval.includes("deep_run") && opts.estimatedUsd >= gov.approvalCostThresholdUsd) {
    if (!(await hasApproval(workspaceId, "deep_run", opts.pipelineId))) {
      await createApprovalRequest({
        workspaceId,
        requesterUserId: opts.actorUserId,
        action: "deep_run",
        targetId: opts.pipelineId,
        reason: "Run exceeds the approval cost threshold",
        estimatedCostUsd: opts.estimatedUsd,
      });
      return {
        allowed: false,
        needsApproval: true,
        reason: `This run needs admin approval (est. $${opts.estimatedUsd.toFixed(2)} ≥ $${gov.approvalCostThresholdUsd} threshold). A request was sent.`,
      };
    }
  }
  return { allowed: true, warn };
}
