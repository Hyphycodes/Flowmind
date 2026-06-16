import { getServerSupabase } from "@/lib/supabase/server";
import { rowToTrigger } from "@/lib/supabase/queries";
import { newId } from "@/lib/pipeline/validate";
import { runPipelineHeadless } from "@/lib/run/headless";
import type { RunTrace } from "@/lib/pipeline/schema";
import { MAX_TRIGGER_CHAIN_DEPTH, RETRY_BACKOFF_MINUTES, type Trigger } from "./schema";

/** Trigger observability (Task 06b). Wraps the headless run with: a per-firing record (health),
 *  bounded auto-retry with backoff (skipping deterministic failures), failure/recovery alerts with
 *  built-in dedupe, and pipeline→pipeline chaining. Server-only. */

// Failures that won't fix themselves on retry — stop early.
const NON_RETRYABLE = /invalid|no nodes|not found|schema|missing input|unauthorized|forbidden|out of credits|no permission/i;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}

function failureError(trace: RunTrace | null): string {
  if (!trace) return "Pipeline not found";
  const step = trace.steps.find((s) => s.status === "error");
  return step ? `${step.title}: ${step.summary ?? "failed"}` : "Run failed";
}

function isRetryable(trace: RunTrace | null): boolean {
  if (!trace) return false; // pipeline missing → deterministic
  return !NON_RETRYABLE.test(failureError(trace));
}

function flatten(d: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) out[k] = typeof v === "string" ? v : String(v ?? "");
  return out;
}

function upstreamToInputs(trace: RunTrace): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of trace.finalOutput?.highlights ?? []) {
    const key = h.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (key) out[key] = h.value;
  }
  return out;
}

async function updateTrigger(id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb.from("triggers").update(patch).eq("id", id);
}

async function recordTriggerRun(triggerId: string, trace: RunTrace | null, attempt: number, startedAt: string): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb.from("trigger_runs").insert({
    id: newId("trun"),
    trigger_id: triggerId,
    run_id: trace?.id ?? null,
    status: trace?.status ?? "error",
    attempt,
    duration_ms: trace?.latencyMs ?? null,
    cost_usd: trace?.costUsd ?? null,
    error: trace?.status === "error" || !trace ? failureError(trace) : null,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

async function sendAlert(
  trigger: Trigger,
  kind: "failure" | "recovery",
  ctx: { error?: string; attempt?: number; runId?: string },
): Promise<void> {
  const events = trigger.alerts?.events ?? ["failure", "recovery"];
  if (!events.includes(kind)) return;
  const link = appUrl() ? `${appUrl()}/editor?open=${trigger.pipelineId}` : undefined;
  const payload = {
    event: kind,
    pipelineId: trigger.pipelineId,
    triggerId: trigger.id,
    triggerType: trigger.type,
    error: ctx.error,
    attempt: ctx.attempt,
    runId: ctx.runId,
    link,
    at: new Date().toISOString(),
  };
  if (trigger.alerts?.webhookUrl) {
    await fetch(trigger.alerts.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
  if (trigger.alerts?.email) await sendEmail(trigger.alerts.email, kind, payload).catch(() => {});
}

/** Email alerts are config-gated on a transactional provider (Resend REST, no new dep). If
 *  RESEND_API_KEY isn't set, email is a no-op (documented in docs/automation.md). */
async function sendEmail(to: string, kind: string, payload: Record<string, unknown>): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERTS_EMAIL_FROM || "Flowmind <alerts@flowmind.app>",
      to,
      subject: kind === "failure" ? "Flowmind: a trigger failed" : "Flowmind: a trigger recovered",
      text: JSON.stringify(payload, null, 2),
    }),
  }).catch(() => {});
}

/** Fire one trigger: run headless, record the firing, then handle retry/alerts/downstream. */
export async function fireTrigger(
  trigger: Trigger,
  opts: { inputs?: Record<string, string>; source: RunTrace["source"]; attempt?: number; depth?: number },
): Promise<RunTrace | null> {
  const attempt = opts.attempt ?? 1;
  const startedAt = new Date().toISOString();
  const inputs = { ...flatten(trigger.defaultInputs), ...(opts.inputs ?? {}) };
  const trace = await runPipelineHeadless({ pipelineId: trigger.pipelineId, inputs, source: opts.source });
  await recordTriggerRun(trigger.id, trace, attempt, startedAt);

  if (trace?.status === "success") {
    // A previously-failing trigger that succeeds resolves the alert.
    if (trigger.alertedFailure) await sendAlert(trigger, "recovery", { runId: trace.id });
    await updateTrigger(trigger.id, {
      last_fired_at: new Date().toISOString(),
      last_status: "success",
      next_retry_at: null,
      retry_attempt: 0,
      last_error: null,
      alerted_failure: false,
    });
    await fireDownstream(trigger.pipelineId, trace, opts.depth ?? 0);
    return trace;
  }

  const error = failureError(trace);
  const maxAttempts = trigger.retry?.maxAttempts ?? 3;
  if (isRetryable(trace) && attempt < maxAttempts) {
    const delayMin = RETRY_BACKOFF_MINUTES[Math.min(attempt - 1, RETRY_BACKOFF_MINUTES.length - 1)];
    await updateTrigger(trigger.id, {
      last_fired_at: new Date().toISOString(),
      last_status: "error",
      next_retry_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
      retry_attempt: attempt,
      last_error: error,
    });
  } else {
    // Exhausted or non-retryable → escalate once (alerted_failure dedupes repeat failures).
    if (!trigger.alertedFailure) await sendAlert(trigger, "failure", { error, attempt, runId: trace?.id });
    await updateTrigger(trigger.id, {
      last_fired_at: new Date().toISOString(),
      last_status: "error",
      next_retry_at: null,
      retry_attempt: 0,
      last_error: error,
      alerted_failure: true,
    });
  }
  return trace;
}

/** After a pipeline completes successfully, fire downstream pipeline→pipeline triggers.
 *  Depth-capped and self-loop-guarded so A→B→A can never loop forever. */
export async function fireDownstream(pipelineId: string, upstreamTrace: RunTrace, depth: number): Promise<void> {
  if (depth >= MAX_TRIGGER_CHAIN_DEPTH) return;
  const sb = getServerSupabase();
  if (!sb) return;
  const { data } = await sb
    .from("triggers")
    .select("*")
    .eq("type", "pipeline")
    .eq("upstream_pipeline_id", pipelineId)
    .eq("enabled", true);
  const triggers = ((data as Record<string, unknown>[]) ?? []).flatMap((r) => {
    const t = rowToTrigger(r);
    return t ? [t] : [];
  });
  for (const t of triggers) {
    if (t.pipelineId === pipelineId) continue; // direct self-loop guard
    await fireTrigger(t, { inputs: upstreamToInputs(upstreamTrace), source: "pipeline", depth: depth + 1 });
  }
}
