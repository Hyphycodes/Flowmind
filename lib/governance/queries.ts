import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  approvalRequestSchema,
  auditEntrySchema,
  governanceConfigSchema,
  type ApprovalRequest,
  type AuditEntry,
  type GovernanceConfig,
} from "./schema";

/** Client-side governance reads/writes (Task 07b). Session-aware so RLS scopes to admins for the
 *  audit log; degrade to empty/false with no session/Supabase. The audit log is read-only here. */

type Row = Record<string, unknown>;

export async function listAuditLog(
  workspaceId: string,
  filters: { action?: string; since?: string } = {},
): Promise<AuditEntry[]> {
  const sb = getBrowserSupabase();
  if (!sb) return [];
  let q = sb.from("audit_log").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.since) q = q.gte("created_at", filters.since);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Row[]).flatMap((r) => {
    try {
      return [
        auditEntrySchema.parse({
          id: r.id,
          workspaceId: r.workspace_id ?? undefined,
          actorUserId: r.actor_user_id ?? undefined,
          action: r.action,
          targetType: r.target_type ?? undefined,
          targetId: r.target_id ?? undefined,
          summary: r.summary ?? undefined,
          metadata: r.metadata ?? {},
          createdAt: r.created_at,
        }),
      ];
    } catch {
      return [];
    }
  });
}

export async function getGovernanceConfig(workspaceId: string): Promise<GovernanceConfig | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb.from("workspace_governance").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (!data) return null;
  const r = data as Row;
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

export async function saveGovernanceConfig(c: GovernanceConfig): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { error } = await sb.from("workspace_governance").upsert(
    {
      workspace_id: c.workspaceId,
      audit_enabled: c.auditEnabled,
      monthly_budget_usd: c.monthlyBudgetUsd ?? null,
      require_approval: c.requireApproval,
      approval_cost_threshold_usd: c.approvalCostThresholdUsd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
  return !error;
}

export async function listApprovalRequests(workspaceId: string): Promise<ApprovalRequest[]> {
  const sb = getBrowserSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("approval_requests")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return (data as Row[]).flatMap((r) => {
    try {
      return [
        approvalRequestSchema.parse({
          id: r.id,
          workspaceId: r.workspace_id ?? undefined,
          requesterUserId: r.requester_user_id ?? undefined,
          action: r.action,
          targetId: r.target_id ?? undefined,
          reason: r.reason ?? undefined,
          estimatedCostUsd: (r.estimated_cost_usd as number | null) ?? undefined,
          status: r.status ?? "pending",
          decidedBy: r.decided_by ?? undefined,
          decidedAt: r.decided_at ?? undefined,
          createdAt: r.created_at,
        }),
      ];
    } catch {
      return [];
    }
  });
}

export async function decideApproval(id: string, status: "approved" | "denied"): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { data: u } = await sb.auth.getUser();
  const { error } = await sb
    .from("approval_requests")
    .update({ status, decided_by: u.user?.id ?? null, decided_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

/** Month-to-date spend grouped by pipeline (and a total) for the spend breakdown. */
export async function workspaceSpend(workspaceId: string): Promise<{ total: number; byPipeline: { id: string; cost: number }[] }> {
  const sb = getBrowserSupabase();
  if (!sb) return { total: 0, byPipeline: [] };
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const { data } = await sb.from("runs").select("pipeline_id,trace,created_at").eq("workspace_id", workspaceId).gte("created_at", since.toISOString());
  const by = new Map<string, number>();
  let total = 0;
  for (const r of (data as { pipeline_id: string; trace?: { costUsd?: number } | null }[]) ?? []) {
    const cost = r.trace?.costUsd ?? 0;
    total += cost;
    by.set(r.pipeline_id, (by.get(r.pipeline_id) ?? 0) + cost);
  }
  return {
    total,
    byPipeline: [...by.entries()].map(([id, cost]) => ({ id, cost })).sort((a, b) => b.cost - a.cost),
  };
}
