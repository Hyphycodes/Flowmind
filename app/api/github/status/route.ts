import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { githubConfigured, githubAppConfigured, githubAppSlug } from "@/lib/auth/config";
import { getGitHubConnectionRow } from "@/lib/github/connection";
import type { GitHubStatusResponse } from "@/lib/github/types";

export const runtime = "nodejs";

/** Sanitized GitHub connection status. NEVER returns tokens. */
export async function GET() {
  const slug = githubAppSlug();
  if (!githubConfigured()) {
    return Response.json({
      configured: false,
      connected: false,
      appSlug: slug,
      message: githubAppConfigured()
        ? "GitHub App is set but auth/encryption is not — set NEXT_PUBLIC_AUTH_ENABLED + FLOWMIND_TOKEN_ENCRYPTION_SECRET."
        : "Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, and NEXT_PUBLIC_GITHUB_APP_SLUG.",
    } satisfies GitHubStatusResponse);
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ configured: true, connected: false, appSlug: slug } satisfies GitHubStatusResponse);

  const sb = await getServerSupabaseAuth();
  const row = sb ? await getGitHubConnectionRow(sb, user.id) : null;
  if (!row) return Response.json({ configured: true, connected: false, appSlug: slug } satisfies GitHubStatusResponse);

  return Response.json({
    configured: true,
    connected: row.status === "connected",
    appSlug: slug,
    accountLogin: row.account_login,
    accountType: (row.account_type as "user" | "organization" | null) ?? null,
    avatarUrl: row.avatar_url,
    installationId: row.installation_id,
    permissions: row.permissions ?? null,
    repositories: row.selected_repositories ?? [],
    status: (row.status as GitHubStatusResponse["status"]) ?? "connected",
    connectedAt: row.created_at,
  } satisfies GitHubStatusResponse);
}
