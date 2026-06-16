import { getServerSupabase } from "@/lib/supabase/server";
import { newId } from "@/lib/pipeline/validate";

export type AuditInput = {
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

/** Append one immutable audit entry (Task 07b). Server-only (service-role write); the audit_log
 *  table has no update/delete policy, so entries are facts. Best-effort — auditing must never break
 *  the action it records. Route ALL audited mutations through this single helper. */
export async function recordAudit(input: AuditInput): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb
    .from("audit_log")
    .insert({
      id: newId("aud"),
      workspace_id: input.workspaceId ?? null,
      actor_user_id: input.actorUserId ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    })
    .then(
      () => {},
      () => {},
    );
}
