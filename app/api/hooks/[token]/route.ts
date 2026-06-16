import { getServerSupabase } from "@/lib/supabase/server";
import { rowToTrigger } from "@/lib/supabase/queries";
import { fireTrigger } from "@/lib/automation/fire";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 300;

// Per-token rate limit (best-effort, in-memory) so an external system can't hammer a pipeline.
const hits = new Map<string, number[]>();
function rateLimited(token: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(token) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(token, arr);
  return arr.length > max;
}

/** Map a webhook body into the pipeline's input fields via the trigger's inputMapping
 *  (pipelineInputKey → bodyFieldName); with no mapping, copy matching body fields directly. */
function mapInputs(body: Record<string, unknown>, mapping: Record<string, string>, defaults: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(defaults)) out[k] = typeof v === "string" ? v : String(v ?? "");
  if (Object.keys(mapping).length) {
    for (const [inputKey, bodyField] of Object.entries(mapping)) {
      const v = body?.[bodyField];
      if (v != null) out[inputKey] = typeof v === "string" ? v : String(v);
    }
  } else {
    for (const [k, v] of Object.entries(body ?? {})) out[k] = typeof v === "string" ? v : String(v ?? "");
  }
  return out;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = getServerSupabase();
  if (!sb) return Response.json({ error: "Automation isn't available." }, { status: 503 });

  const { data } = await sb
    .from("triggers")
    .select("*")
    .eq("type", "webhook")
    .eq("enabled", true)
    .filter("webhook->>token", "eq", token)
    .maybeSingle();
  const trigger = data ? rowToTrigger(data as Record<string, unknown>) : null;
  if (!trigger || trigger.webhook?.token !== token) {
    return Response.json({ error: "Invalid or disabled webhook." }, { status: 404 });
  }
  if (rateLimited(token)) {
    return Response.json({ error: "Rate limited — slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const inputs = mapInputs(
    (body && typeof body === "object" ? (body as Record<string, unknown>) : {}),
    trigger.webhook?.inputMapping ?? {},
    trigger.defaultInputs,
  );

  try {
    const trace = await fireTrigger(trigger, { inputs, source: "webhook" });
    if (!trace) return Response.json({ error: "Pipeline not found." }, { status: 404 });
    return Response.json({ runId: trace.id, status: trace.status, finalOutput: trace.finalOutput });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Webhook run failed.") }, { status: 500 });
  }
}
