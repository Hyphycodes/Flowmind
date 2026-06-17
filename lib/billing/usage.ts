import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { billingEnabled, stripeConfigured } from "@/lib/auth/config";
import { getPlan } from "./plans";
import type {
  BillingAccount,
  CreditEvent,
  CreditEventType,
  PlanId,
  UsageCounters,
  UsageEvent,
} from "./types";

/** Server-side billing state + logging. All functions degrade gracefully: when billing is OFF,
 *  there's no signed-in user, or the tables aren't migrated, they return generous defaults and
 *  swallow errors so the core product never breaks. */

export function currentPeriod(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** A generous default account — used when billing is OFF, unauthenticated, or DB unavailable.
 *  Gates treat `billingEnabled: false` as "always allow". */
function defaultAccount(planId: PlanId = "free"): BillingAccount {
  const enabled = billingEnabled();
  // When billing is OFF, present a generous "Pro" preview so the meter looks calm + unlimited.
  const resolvedId: PlanId = enabled ? planId : "pro";
  const plan = getPlan(resolvedId);
  const { start, end } = currentPeriod();
  return {
    planId: resolvedId,
    plan,
    status: "none",
    billingEnabled: enabled,
    stripeConfigured: stripeConfigured(),
    balance: {
      userId: "",
      balance: plan.includedCredits,
      monthlyGrantRemaining: plan.includedCredits,
      purchasedCreditsRemaining: 0,
      periodStart: start,
      periodEnd: end,
      updatedAt: new Date().toISOString(),
    },
    counters: {},
    periodStart: start,
    periodEnd: end,
  };
}

async function readPlanId(sb: SupabaseClient, userId: string): Promise<{ planId: PlanId; status: string; cancelAtPeriodEnd?: boolean }> {
  try {
    const { data } = await sb
      .from("subscriptions")
      .select("plan_id,status,cancel_at_period_end")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.plan_id) return { planId: data.plan_id as PlanId, status: data.status ?? "active", cancelAtPeriodEnd: data.cancel_at_period_end ?? false };
  } catch {
    /* table not migrated — fall through */
  }
  return { planId: "free", status: "none" };
}

async function readCounters(sb: SupabaseClient, userId: string, periodStart: string): Promise<UsageCounters> {
  try {
    const { data } = await sb
      .from("usage_counters")
      .select("counters")
      .eq("user_id", userId)
      .eq("period_start", periodStart)
      .maybeSingle();
    return (data?.counters as UsageCounters) ?? {};
  } catch {
    return {};
  }
}

/** Build the full billing account for the current request (or a default when unavailable). */
export async function getBillingAccount(): Promise<BillingAccount> {
  if (!billingEnabled()) return defaultAccount();
  const user = await getCurrentUser();
  const sb = await getServerSupabaseAuth();
  if (!user || !sb) return defaultAccount("free");

  const { start, end } = currentPeriod();
  const { planId, status, cancelAtPeriodEnd } = await readPlanId(sb, user.id);
  const plan = getPlan(planId);
  const counters = await readCounters(sb, user.id, start);

  const spent = counters.creditsSpent ?? 0;
  const purchased = counters.purchasedCredits ?? 0;
  const monthlyGrantRemaining = Math.max(0, plan.includedCredits - spent);
  const balance = Math.max(0, plan.includedCredits + purchased - spent);

  return {
    planId,
    plan,
    status,
    billingEnabled: true,
    stripeConfigured: stripeConfigured(),
    cancelAtPeriodEnd,
    balance: {
      userId: user.id,
      balance,
      monthlyGrantRemaining,
      purchasedCreditsRemaining: purchased,
      periodStart: start,
      periodEnd: end,
      updatedAt: new Date().toISOString(),
    },
    counters,
    periodStart: start,
    periodEnd: end,
  };
}

/** Atomically bump period counters (best-effort upsert). */
async function bumpCounters(sb: SupabaseClient, userId: string, delta: UsageCounters): Promise<void> {
  const { start, end } = currentPeriod();
  try {
    const existing = await readCounters(sb, userId, start);
    const merged: UsageCounters = { ...existing };
    for (const [k, v] of Object.entries(delta)) merged[k] = (merged[k] ?? 0) + (v ?? 0);
    await sb.from("usage_counters").upsert(
      { user_id: userId, period_start: start, period_end: end, counters: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id,workspace_id,period_start" },
    );
  } catch {
    /* table not migrated — ignore */
  }
}

export type LogCreditInput = {
  eventType: CreditEventType;
  creditsDelta: number; // negative = spend
  pipelineId?: string;
  runId?: string;
  takeId?: string;
  modelCostEstimate?: CreditEvent["modelCostEstimate"];
  metadata?: Record<string, unknown>;
};

/** Record a credit event + update counters. Server-side, best-effort, never throws. */
export async function logCreditEvent(input: LogCreditInput): Promise<void> {
  if (!billingEnabled()) return;
  try {
    const user = await getCurrentUser();
    const sb = await getServerSupabaseAuth();
    if (!user || !sb) return;
    await sb.from("credit_events").insert({
      user_id: user.id,
      pipeline_id: input.pipelineId,
      run_id: input.runId,
      take_id: input.takeId,
      event_type: input.eventType,
      credits_delta: input.creditsDelta,
      model_cost_estimate: input.modelCostEstimate ?? null,
      metadata: input.metadata ?? null,
    });
    const counterDelta: UsageCounters = {};
    if (input.creditsDelta < 0) counterDelta.creditsSpent = -input.creditsDelta;
    if (input.eventType === "credit_purchase" && input.creditsDelta > 0) counterDelta.purchasedCredits = input.creditsDelta;
    await bumpCounters(sb, user.id, counterDelta);
  } catch {
    /* ignore */
  }
}

/** Record a usage event (model/team/agent/export/tool) for analytics + cost trace. */
export async function logUsageEvent(event: Omit<UsageEvent, "id" | "userId" | "createdAt">): Promise<void> {
  if (!billingEnabled()) return;
  try {
    const user = await getCurrentUser();
    const sb = await getServerSupabaseAuth();
    if (!user || !sb) return;
    await sb.from("usage_events").insert({
      user_id: user.id,
      type: event.type,
      pipeline_id: event.pipelineId,
      node_id: event.nodeId,
      team_id: event.teamId,
      agent_id: event.agentId,
      provider_id: event.providerId,
      model_id: event.modelId,
      tool_id: event.toolId,
      credits_used: event.creditsUsed,
      token_usage: event.tokenUsage ?? null,
      cost_estimate: event.costEstimate ?? null,
      metadata: event.metadata ?? null,
    });
  } catch {
    /* ignore */
  }
}

/** Convenience: increment a named usage counter (e.g. realRuns, exports, githubPrExports). */
export async function incrementUsageCounter(name: keyof UsageCounters, by = 1): Promise<void> {
  if (!billingEnabled()) return;
  try {
    const user = await getCurrentUser();
    const sb = await getServerSupabaseAuth();
    if (!user || !sb) return;
    await bumpCounters(sb, user.id, { [name]: by } as UsageCounters);
  } catch {
    /* ignore */
  }
}

/** Spend credits + count a real run in one shot (called after a run completes). */
export async function recordRunSpend(input: {
  credits: number;
  pipelineId?: string;
  runId?: string;
  modelCostEstimate?: CreditEvent["modelCostEstimate"];
}): Promise<void> {
  if (!billingEnabled() || input.credits <= 0) return;
  await logCreditEvent({
    eventType: "team_run",
    creditsDelta: -input.credits,
    pipelineId: input.pipelineId,
    runId: input.runId,
    modelCostEstimate: input.modelCostEstimate,
  });
  await incrementUsageCounter("realRuns", 1);
}

/** Count one AI design call against the EDITS pool (Prompt 20). Called ONLY after the AI call
 *  succeeds — a failed edit/generation never consumes a credit (no refund logic needed because the
 *  increment is success-gated). Metered by count, not token cost (cost-weighting is a future v2). */
export async function recordEditSpend(): Promise<void> {
  if (!billingEnabled()) return;
  await incrementUsageCounter("edits", 1);
}
