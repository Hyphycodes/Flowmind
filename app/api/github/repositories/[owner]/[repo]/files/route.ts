import { getGitHubContext, clientForRepo, ERROR_STATUS } from "@/lib/github/server";

export const runtime = "nodejs";

/** Read a single file's text from a connected repo (GitHub Read File source/tool). */
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
  const path = url.searchParams.get("path");
  const ref = url.searchParams.get("ref") ?? undefined;
  if (!path) return Response.json({ error: "Missing path" }, { status: 400 });

  const file = await client.readFile(path, ref);
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ path, ...file });
}
