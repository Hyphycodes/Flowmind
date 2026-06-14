import { getGitHubContext, clientForRepo, ERROR_STATUS } from "@/lib/github/server";

export const runtime = "nodejs";

/** GitHub List Issues source/tool. `repo` = "owner/name". */
export async function GET(req: Request) {
  const ctx = await getGitHubContext();
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ERROR_STATUS[ctx.error] });

  const url = new URL(req.url);
  const repo = url.searchParams.get("repo") ?? "";
  const state = (url.searchParams.get("state") as "open" | "closed" | "all") ?? "open";
  const [owner, name] = repo.split("/");
  if (!owner || !name) return Response.json({ error: "repo must be owner/name" }, { status: 400 });

  const client = await clientForRepo(ctx, owner, name);
  if ("error" in client) return Response.json({ error: client.error }, { status: ERROR_STATUS[client.error] });

  try {
    const issues = await client.listIssues(state);
    return Response.json({ issues });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
