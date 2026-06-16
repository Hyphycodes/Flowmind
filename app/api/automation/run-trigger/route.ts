import { getServerSupabase } from "@/lib/supabase/server";
import { rowToTrigger } from "@/lib/supabase/queries";
import { fireTrigger } from "@/lib/automation/fire";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Manual controls (Task 06b): "run now" and "retry last failed" both fire the trigger through the
 *  same headless path (with observability). Triggers are owner-scoped by RLS. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const triggerId = (body as { triggerId?: unknown }).triggerId;
  if (typeof triggerId !== "string") return Response.json({ error: "Missing triggerId" }, { status: 400 });

  const sb = getServerSupabase();
  if (!sb) return Response.json({ error: "Automation isn't available." }, { status: 503 });
  const { data } = await sb.from("triggers").select("*").eq("id", triggerId).maybeSingle();
  const trigger = data ? rowToTrigger(data as Record<string, unknown>) : null;
  if (!trigger) return Response.json({ error: "Trigger not found." }, { status: 404 });

  try {
    const source = trigger.type === "webhook" ? "webhook" : trigger.type === "pipeline" ? "pipeline" : "schedule";
    const trace = await fireTrigger(trigger, { source });
    return Response.json({ runId: trace?.id ?? null, status: trace?.status ?? "error" });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Run failed.") }, { status: 500 });
  }
}
