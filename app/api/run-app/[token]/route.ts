import { effectiveShareLevel, getShareByToken, getSharedPipeline } from "@/lib/sharing/server";
import { runPipelineCore } from "@/lib/run/core";
import { saveRunServer } from "@/lib/run/headless";
import { consumeEntitlement, getPricing, hasEntitlement, hashRef, recordShareRun } from "@/lib/sharing/monetization";
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

  // Permission derived from the share record + auth, server-side — never trusted from the client.
  const share = await getShareByToken(token);
  if (!share) return Response.json({ error: "This share link is not valid." }, { status: 404 });

  const level = await effectiveShareLevel(share, true);
  if (level !== "run" && level !== "edit") {
    return Response.json({ error: "You don't have permission to run this." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rb = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawInputs = (rb.inputs as Record<string, unknown> | undefined) ?? {};
  const inputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawInputs)) inputs[k] = typeof v === "string" ? v : String(v ?? "");
  const requesterEmail = typeof rb.requesterEmail === "string" ? rb.requesterEmail.trim() : "";
  const requesterRef = requesterEmail ? hashRef(requesterEmail) : undefined;

  // ── Paywall: a priced share requires an entitlement (server-enforced, never the UI) ──
  const pricing = getPricing(share);
  if (pricing.mode !== "free") {
    if (!requesterRef || !(await hasEntitlement(share.id, requesterRef))) {
      return Response.json(
        { paywall: { mode: pricing.mode, amountUsd: pricing.amountUsd, currency: pricing.currency } },
        { status: 402 },
      );
    }
  }
  if (rateLimited(token)) {
    return Response.json({ error: "Too many runs — try again in a minute." }, { status: 429 });
  }

  const pipeline = await getSharedPipeline(share.pipelineId);
  if (!pipeline) return Response.json({ error: "Shared pipeline not found." }, { status: 404 });

  try {
    // Run the owner's pipeline server-side; the requester only ever gets the stripped results.
    const trace = await runPipelineCore(pipeline, { mode: "hybrid", inputs, source: "manual" });
    await saveRunServer(trace); // persist so the owner can inspect (and link to) failing traces

    // Privacy: record input *keys* by default; *values* only when the owner opts in.
    const inputKeys = pricing.captureInputValues
      ? Object.entries(inputs).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
      : Object.keys(inputs);
    await recordShareRun(share.id, {
      requesterRef,
      status: trace.status,
      durationMs: trace.latencyMs,
      costUsd: trace.costUsd,
      inputKeys,
      runId: trace.id,
    });
    if (pricing.mode === "per_run" && requesterRef) await consumeEntitlement(share.id, requesterRef);

    const boundIds = new Set(pipeline.uiBindings.map((b) => b.tableId));
    const out = boundIds.size ? trace.tables.filter((t) => boundIds.has(t.id)) : trace.tables;
    return Response.json({ finalOutput: trace.finalOutput, tables: out });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Run failed.") }, { status: 500 });
  }
}
