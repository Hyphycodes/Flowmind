import { getServerSupabase } from "@/lib/supabase/server";
import { rowToTrigger } from "@/lib/supabase/queries";
import { cronMatches } from "./cron";
import { fireTrigger } from "./fire";
import type { Trigger } from "./schema";

/** The schedule + retry worker (Task 06 / 06b). Invoked by the cron tick every minute: fires
 *  schedule triggers whose cron matches now, and re-runs any trigger whose backoff retry is due.
 *  lastFiredAt prevents double-firing a schedule within the same minute. Server-only. */

function toTriggers(data: unknown): Trigger[] {
  return ((data as Record<string, unknown>[]) ?? []).flatMap((r) => {
    const t = rowToTrigger(r);
    return t ? [t] : [];
  });
}

function firedThisMinute(t: Trigger, now: Date): boolean {
  if (!t.lastFiredAt) return false;
  return new Date(t.lastFiredAt).toISOString().slice(0, 16) === now.toISOString().slice(0, 16);
}

export async function processDueTriggers(now: Date = new Date()): Promise<{ scheduled: number; retried: number; checked: number }> {
  const sb = getServerSupabase();
  if (!sb) return { scheduled: 0, retried: 0, checked: 0 };

  // 1. Schedule triggers whose cron matches this minute.
  const sched = toTriggers((await sb.from("triggers").select("*").eq("type", "schedule").eq("enabled", true)).data);
  let scheduled = 0;
  for (const t of sched) {
    if (!t.schedule?.cron) continue;
    if (!cronMatches(t.schedule.cron, now, t.schedule.timezone)) continue;
    if (firedThisMinute(t, now)) continue;
    await fireTrigger(t, { source: "schedule" });
    scheduled++;
  }

  // 2. Due retries (any enabled trigger whose backoff window has elapsed).
  const retries = toTriggers(
    (
      await sb
        .from("triggers")
        .select("*")
        .eq("enabled", true)
        .not("next_retry_at", "is", null)
        .lte("next_retry_at", now.toISOString())
    ).data,
  );
  let retried = 0;
  for (const t of retries) {
    const source = t.type === "webhook" ? "webhook" : t.type === "pipeline" ? "pipeline" : "schedule";
    await fireTrigger(t, { source, attempt: (t.retryAttempt ?? 1) + 1 });
    retried++;
  }

  return { scheduled, retried, checked: sched.length + retries.length };
}
