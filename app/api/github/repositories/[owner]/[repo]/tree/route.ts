import { getGitHubContext, clientForRepo, ERROR_STATUS } from "@/lib/github/server";
import { detectRepoStructure } from "@/lib/github/fileTree";

export const runtime = "nodejs";

/** Repo file tree + a file-placement suggestion. Next 16: dynamic params are async. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  const ctx = await getGitHubContext();
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ERROR_STATUS[ctx.error] });

  const client = await clientForRepo(ctx, owner, repo);
  if ("error" in client) return Response.json({ error: client.error }, { status: ERROR_STATUS[client.error] });

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "pipeline";
  const repoRef = (ctx.row.selected_repositories ?? []).find((r) => r.fullName.toLowerCase() === `${owner}/${repo}`.toLowerCase());
  const branch = url.searchParams.get("ref") ?? repoRef?.defaultBranch ?? "main";

  try {
    const entries = await client.getRootEntries(branch);
    const structure = detectRepoStructure(entries, slug);
    return Response.json({ branch, topLevel: entries, structure });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
