import { getServerSupabase } from "@/lib/supabase/server";
import { rowToTrigger } from "@/lib/supabase/queries";
import { runPipelineHeadless } from "@/lib/run/headless";
import { cronMatches } from "./cron";
import type { Trigger } from "./schema";

/** The schedule worker (Task 06). Invoked by the cron tick every minute: finds enabled schedule
 *  triggers whose cron matches the current minute (in their timezone) and fires the headless run
 *  core. lastFiredAt prevents double-firing within the same minute. Server-only (trusted client). */

function firedThisMinute(t: Trigger, now: Date): boolean {
  if (!t.lastFiredAt) return false;
  return new Date(t.lastFiredAt).toISOString().slice(0, 16) === now.toISOString().slice(0, 16);
}

function flatten(d: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) out[k] = typeof v === "string" ? v : String(v ?? "");
  return out;
}

export async function processDueTriggers(now: Date = new Date()): Promise<{ fired: number; checked: number }> {
  const sb = getServerSupabase();
  if (!sb) return { fired: 0, checked: 0 };
  const { data } = await sb.from("triggers").select("*").eq("type", "schedule").eq("enabled", true);
  const triggers = ((data as Record<string, unknown>[]) ?? []).flatMap((r) => {
    const t = rowToTrigger(r);
    return t ? [t] : [];
  });

  let fired = 0;
  for (const t of triggers) {
    if (!t.schedule?.cron) continue;
    if (!cronMatches(t.schedule.cron, now, t.schedule.timezone)) continue;
    if (firedThisMinute(t, now)) continue;
    await runPipelineHeadless({ pipelineId: t.pipelineId, inputs: flatten(t.defaultInputs), source: "schedule", triggerId: t.id });
    fired++;
  }
  return { fired, checked: triggers.length };
}
