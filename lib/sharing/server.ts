import { pipelineSchema, type Pipeline } from "@/lib/pipeline/schema";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";
import { pipelineShareSchema, type PipelineShare, type ShareLevel } from "./schema";

/** Server-only trusted reads for the hosted Run-App. Uses getServerSupabase (service role when
 *  configured, else the anon client which can only read null-owned demo rows). The link_token is
 *  the capability; this module validates it and reads the owner's pipeline on the requester's
 *  behalf. The requester never gets the raw pipeline — only the stripped manifest + results. */

function rowToShare(row: Record<string, unknown>): PipelineShare | null {
  try {
    return pipelineShareSchema.parse({
      id: row.id,
      pipelineId: row.pipeline_id,
      ownerId: (row.user_id as string | null) ?? null,
      level: row.level ?? "run",
      recipients: row.recipients ?? [],
      linkEnabled: row.link_enabled ?? false,
      linkToken: (row.link_token as string | null) ?? undefined,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export async function getShareByToken(token: string): Promise<PipelineShare | null> {
  const sb = getServerSupabase();
  if (!sb || !token) return null;
  const { data, error } = await sb
    .from("pipeline_shares")
    .select("*")
    .eq("link_token", token)
    .eq("link_enabled", true)
    .maybeSingle();
  if (error || !data) return null;
  return rowToShare(data as Record<string, unknown>);
}

export async function getShareById(id: string): Promise<PipelineShare | null> {
  const sb = getServerSupabase();
  if (!sb || !id) return null;
  const { data, error } = await sb.from("pipeline_shares").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToShare(data as Record<string, unknown>);
}

/** Read the shared pipeline server-side (trusted) — never returned raw to the client. */
export async function getSharedPipeline(pipelineId: string): Promise<Pipeline | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("pipelines").select("*").eq("id", pipelineId).maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; name: string; description: string | null; graph: Record<string, unknown> | null };
  try {
    return pipelineSchema.parse({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      ...(row.graph ?? {}),
      runHistory: [],
    });
  } catch {
    return null;
  }
}

/**
 * The effective access level for THIS requester — derived server-side, never trusted from the
 * client. Owner → edit. Authed recipient (by email) → the granted level. Valid link → the granted
 * level, but an anonymous link is capped at `run` (edit/collab requires an authed recipient).
 * Returns null when the requester has no access.
 */
export async function effectiveShareLevel(share: PipelineShare, viaToken: boolean): Promise<ShareLevel | null> {
  const user = await getCurrentUser();
  if (user && share.ownerId && user.id === share.ownerId) return "edit";
  if (
    user?.email &&
    share.recipients.some((r) => r.email.trim().toLowerCase() === user.email!.trim().toLowerCase())
  ) {
    return share.level;
  }
  if (viaToken && share.linkEnabled) {
    return share.level === "edit" ? "run" : share.level;
  }
  return null;
}
