import { effectiveShareLevel, getShareByToken, getSharedPipeline } from "@/lib/sharing/server";
import { runSharedPipeline } from "@/lib/sharing/run";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 300;

// Crude per-token rate limit (best-effort, in-memory) to blunt abuse of a public link.
const hits = new Map<string, number[]>();
function rateLimited(token: string, max = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(token) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(token, arr);
  return arr.length > max;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Permission is derived from the share record + auth, server-side — never trusted from the client.
  const share = await getShareByToken(token);
  if (!share) return Response.json({ error: "This share link is not valid." }, { status: 404 });

  const level = await effectiveShareLevel(share, true);
  if (level !== "run" && level !== "edit") {
    return Response.json({ error: "You don't have permission to run this." }, { status: 403 });
  }
  if (rateLimited(token)) {
    return Response.json({ error: "Too many runs — try again in a minute." }, { status: 429 });
  }

  const pipeline = await getSharedPipeline(share.pipelineId);
  if (!pipeline) return Response.json({ error: "Shared pipeline not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawInputs = (body && typeof body === "object" ? (body as { inputs?: unknown }).inputs : {}) ?? {};
  const inputs: Record<string, string> = {};
  if (rawInputs && typeof rawInputs === "object") {
    for (const [k, v] of Object.entries(rawInputs as Record<string, unknown>)) {
      inputs[k] = typeof v === "string" ? v : String(v ?? "");
    }
  }

  try {
    const { finalOutput, tables } = await runSharedPipeline(pipeline, inputs);
    // Results-only: the final output + ONLY the declared (bound) output tables. Never prompts,
    // model config, data sources, or per-node traces.
    const boundIds = new Set(pipeline.uiBindings.map((b) => b.tableId));
    const out = boundIds.size ? tables.filter((t) => boundIds.has(t.id)) : tables;
    return Response.json({ finalOutput, tables: out });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Run failed.") }, { status: 500 });
  }
}
