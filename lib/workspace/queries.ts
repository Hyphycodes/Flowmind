import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  membershipSchema,
  workspaceSchema,
  type Membership,
  type Workspace,
  type WorkspaceRole,
} from "./schema";

/** Workspace management (Task 07). Uses the session-aware browser client so RLS sees the caller's
 *  identity — membership is the access boundary. All functions degrade to empty/false when there's
 *  no session or Supabase (the public demo runs null-workspace and never touches these). */

type Row = Record<string, unknown>;

async function userId(): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

function toWorkspace(w: Row, role?: string): Workspace | null {
  try {
    return workspaceSchema.parse({
      id: w.id,
      name: w.name ?? "Workspace",
      slug: (w.slug as string | null) ?? undefined,
      plan: (w.plan as string | null) ?? undefined,
      role: role as WorkspaceRole | undefined,
      createdAt: (w.created_at as string | null) ?? new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function listMyWorkspaces(): Promise<Workspace[]> {
  const sb = getBrowserSupabase();
  if (!sb) return [];
  const uid = await userId();
  if (!uid) return [];
  const { data, error } = await sb
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", uid)
    .eq("status", "active");
  if (error || !data) return [];
  // The nested relation may type as object or array depending on supabase-js; normalize it.
  return (data as unknown as { role: string; workspaces: Row | Row[] | null }[]).flatMap((row) => {
    const wsRow = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
    const w = wsRow ? toWorkspace(wsRow, row.role) : null;
    return w ? [w] : [];
  });
}

export async function createWorkspace(name: string): Promise<Workspace | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const uid = await userId();
  if (!uid) return null;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await sb.from("workspaces").insert({ owner_id: uid, name, slug }).select().single();
  if (error || !data) return null;
  await sb.from("workspace_members").insert({ workspace_id: (data as Row).id, user_id: uid, role: "owner", status: "active" });
  return toWorkspace(data as Row, "owner");
}

export async function listMembers(workspaceId: string): Promise<Membership[]> {
  const sb = getBrowserSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("workspace_members").select("*").eq("workspace_id", workspaceId).order("created_at");
  if (error || !data) return [];
  return (data as Row[]).flatMap((r) => {
    try {
      return [
        membershipSchema.parse({
          id: r.id,
          workspaceId: r.workspace_id,
          userId: (r.user_id as string | null) ?? null,
          role: r.role ?? "member",
          invitedEmail: (r.invited_email as string | null) ?? undefined,
          status: r.status ?? "active",
          createdAt: (r.created_at as string | null) ?? new Date().toISOString(),
        }),
      ];
    } catch {
      return [];
    }
  });
}

export async function inviteMember(workspaceId: string, email: string, role: WorkspaceRole): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, invited_email: email.trim().toLowerCase(), role, status: "invited", user_id: null });
  return !error;
}

export async function updateMemberRole(membershipId: string, role: WorkspaceRole): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { error } = await sb.from("workspace_members").update({ role }).eq("id", membershipId);
  return !error;
}

export async function removeMember(membershipId: string): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { error } = await sb.from("workspace_members").delete().eq("id", membershipId);
  return !error;
}

/** On login, claim any invitations sent to the user's email (links the membership to their id). */
export async function acceptInvites(): Promise<number> {
  const sb = getBrowserSupabase();
  if (!sb) return 0;
  const { data: u } = await sb.auth.getUser();
  const email = u.user?.email;
  const uid = u.user?.id;
  if (!email || !uid) return 0;
  const { data } = await sb
    .from("workspace_members")
    .update({ user_id: uid, status: "active" })
    .eq("invited_email", email.toLowerCase())
    .is("user_id", null)
    .select();
  return (data as Row[] | null)?.length ?? 0;
}

/** Agency → client handoff: move a pipeline to another workspace (must be editor in both, per RLS). */
export async function transferPipeline(pipelineId: string, toWorkspaceId: string): Promise<boolean> {
  const sb = getBrowserSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pipelines").update({ workspace_id: toWorkspaceId }).eq("id", pipelineId);
  return !error;
}
