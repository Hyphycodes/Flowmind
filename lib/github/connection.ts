import type { SupabaseClient } from "@supabase/supabase-js";
import type { GitHubPermissionSummary, GitHubRepositoryRef } from "./types";

/** GitHub connection persistence. With the GitHub App path there is no stored token: the
 *  installation access token is minted on demand from the App private key + installation_id,
 *  so the DB only holds connection METADATA (installation id, account, permissions, repos). */

export type GitHubConnectionRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  provider: string;
  github_user_id: string | null;
  username: string | null;
  avatar_url: string | null;
  installation_id: string | null;
  account_type: string | null;
  account_login: string | null;
  permissions: GitHubPermissionSummary | null;
  selected_repositories: GitHubRepositoryRef[] | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

export async function getGitHubConnectionRow(
  sb: SupabaseClient,
  userId: string,
): Promise<GitHubConnectionRow | null> {
  const { data, error } = await sb
    .from("github_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "github")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as GitHubConnectionRow;
}

/** Verify a repository belongs to the connection's installation before any write op. */
export function repoBelongsToConnection(row: GitHubConnectionRow, fullName: string): boolean {
  const repos = row.selected_repositories ?? [];
  if (repos.length === 0) return true; // installation grants all-repo selection
  return repos.some((r) => r.fullName.toLowerCase() === fullName.toLowerCase());
}
