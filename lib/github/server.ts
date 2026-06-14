import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser, type FlowmindUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { githubConfigured } from "@/lib/auth/config";
import { getInstallationToken } from "./app";
import { GitHubClient } from "./client";
import { getGitHubConnectionRow, repoBelongsToConnection, type GitHubConnectionRow } from "./connection";

/** Server-side guard used by every GitHub write/read route. Returns a typed error code the
 *  caller turns into an HTTP response. Tokens are minted here and never leave the server. */
export type GitHubContextError =
  | "unconfigured"
  | "unauthenticated"
  | "not_connected"
  | "no_installation"
  | "repo_not_allowed";

export type GitHubContext = {
  user: FlowmindUser;
  sb: SupabaseClient;
  row: GitHubConnectionRow;
  installationId: string;
};

export async function getGitHubContext(): Promise<GitHubContext | { error: GitHubContextError }> {
  if (!githubConfigured()) return { error: "unconfigured" };
  const user = await getCurrentUser();
  if (!user) return { error: "unauthenticated" };
  const sb = await getServerSupabaseAuth();
  if (!sb) return { error: "unauthenticated" };
  const row = await getGitHubConnectionRow(sb, user.id);
  if (!row || row.status === "revoked") return { error: "not_connected" };
  if (!row.installation_id) return { error: "no_installation" };
  return { user, sb, row, installationId: row.installation_id };
}

/** Build an authenticated client for a specific repo, enforcing it belongs to the install. */
export async function clientForRepo(
  ctx: GitHubContext,
  owner: string,
  repo: string,
): Promise<GitHubClient | { error: GitHubContextError }> {
  const fullName = `${owner}/${repo}`;
  if (!repoBelongsToConnection(ctx.row, fullName)) return { error: "repo_not_allowed" };
  const token = await getInstallationToken(ctx.installationId);
  return new GitHubClient(token, owner, repo);
}

export const ERROR_STATUS: Record<GitHubContextError, number> = {
  unconfigured: 503,
  unauthenticated: 401,
  not_connected: 409,
  no_installation: 409,
  repo_not_allowed: 403,
};
