import { getGitHubContext, ERROR_STATUS } from "@/lib/github/server";
import { listInstallationRepositories } from "@/lib/github/app";

export const runtime = "nodejs";

/** List repositories the connected installation can access. Refreshes the cached selection. */
export async function GET() {
  const ctx = await getGitHubContext();
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ERROR_STATUS[ctx.error] });

  try {
    const repos = await listInstallationRepositories(ctx.installationId, ctx.row.permissions ?? undefined);
    // Best-effort refresh of the cached repo list.
    await ctx.sb
      .from("github_connections")
      .update({ selected_repositories: repos, updated_at: new Date().toISOString() })
      .eq("id", ctx.row.id);
    return Response.json({ repositories: repos });
  } catch (err) {
    return Response.json({ error: (err as Error).message, repositories: ctx.row.selected_repositories ?? [] }, { status: 502 });
  }
}
