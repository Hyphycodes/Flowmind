import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { githubConfigured } from "@/lib/auth/config";
import { getInstallation, listInstallationRepositories } from "@/lib/github/app";

export const runtime = "nodejs";

/** GitHub App installation callback. We persist installation METADATA only — no tokens, since
 *  installation access tokens are minted on demand from the App private key + installation_id. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const installationId = url.searchParams.get("installation_id");
  const state = url.searchParams.get("state");
  const setupAction = url.searchParams.get("setup_action");

  if (!githubConfigured()) return NextResponse.redirect(`${origin}/account?github=unconfigured`);

  const cookieStore = await cookies();
  const saved = cookieStore.get("gh_install_state")?.value;
  // State is best-effort (GitHub doesn't always round-trip it for org installs).
  if (state && saved && state !== saved) return NextResponse.redirect(`${origin}/account?github=state_error`);

  const user = await getCurrentUser();
  const sb = await getServerSupabaseAuth();
  if (!user || !sb) return NextResponse.redirect(`${origin}/login?next=/account`);

  if (setupAction === "request") {
    // Org admin must approve the install — record nothing yet.
    return NextResponse.redirect(`${origin}/account?github=pending`);
  }
  if (!installationId) return NextResponse.redirect(`${origin}/account?github=error`);

  try {
    const inst = await getInstallation(installationId);
    const repos = await listInstallationRepositories(installationId, inst.permissions).catch(() => []);
    await sb.from("github_connections").upsert(
      {
        user_id: user.id,
        provider: "github",
        github_user_id: inst.githubUserId,
        username: inst.accountLogin,
        avatar_url: inst.avatarUrl,
        installation_id: installationId,
        account_type: inst.accountType,
        account_login: inst.accountLogin,
        permissions: inst.permissions,
        selected_repositories: repos,
        status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
  } catch {
    return NextResponse.redirect(`${origin}/account?github=error`);
  }

  const res = NextResponse.redirect(`${origin}/account?connected=github`);
  res.cookies.delete("gh_install_state");
  return res;
}
