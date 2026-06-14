import { getGitHubContext, clientForRepo, ERROR_STATUS } from "@/lib/github/server";
import { pipelineSchema, productDropSchema, realityMeterSchema } from "@/lib/pipeline/schema";
import { generateProductDrop } from "@/lib/product/productDrop";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { buildExportHealthCheck } from "@/lib/export/healthCheck";
import { generateIssueDrafts } from "@/lib/github/issues";
import type { GitHubIssueDraft } from "@/lib/github/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET → draft implementation issues from the Reality Meter + health check (no writes).
 *  POST → create the selected issues in the repo. */
async function draftsFromBody(body: { pipeline?: unknown; productDrop?: unknown; realityMeter?: unknown }) {
  const parsed = pipelineSchema.safeParse(body.pipeline);
  if (!parsed.success) return null;
  const pipeline = parsed.data;
  const drop = productDropSchema.safeParse(body.productDrop).success
    ? productDropSchema.parse(body.productDrop)
    : generateProductDrop(pipeline);
  const reality = realityMeterSchema.safeParse(body.realityMeter).success
    ? realityMeterSchema.parse(body.realityMeter)
    : calculateRealityMeter(pipeline, {});
  const health = buildExportHealthCheck({ pipeline });
  return { pipeline, drafts: generateIssueDrafts({ pipeline, reality, drop, health }) };
}

export async function POST(req: Request) {
  const ctx = await getGitHubContext();
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ERROR_STATUS[ctx.error] });

  let body: {
    repository?: { owner: string; name: string };
    pipeline?: unknown;
    productDrop?: unknown;
    realityMeter?: unknown;
    issues?: GitHubIssueDraft[];
    previewOnly?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Preview mode: just return drafts, no repo write.
  if (body.previewOnly || !body.repository) {
    const result = await draftsFromBody(body);
    if (!result) return Response.json({ error: "Invalid pipeline" }, { status: 400 });
    return Response.json({ drafts: result.drafts });
  }

  const client = await clientForRepo(ctx, body.repository.owner, body.repository.name);
  if ("error" in client) return Response.json({ error: client.error }, { status: ERROR_STATUS[client.error] });

  const drafts = body.issues ?? (await draftsFromBody(body))?.drafts ?? [];
  const created: Array<{ title: string; number?: number; url?: string; error?: string }> = [];
  for (const d of drafts) {
    try {
      const issue = await client.createIssue(d);
      created.push({ title: d.title, number: issue.number, url: issue.html_url });
    } catch (err) {
      created.push({ title: d.title, error: (err as Error).message });
    }
  }
  return Response.json({ created });
}
