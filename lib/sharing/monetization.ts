import { createHash } from "node:crypto";
import { getServerSupabase } from "@/lib/supabase/server";
import { newId } from "@/lib/pipeline/validate";
import { sharePricingSchema, type PipelineShare, type SharePricing } from "./schema";

/** Run-App monetization (Task 05b). Server-only. Pricing is enforced here, never in the UI:
 *  priced runs require an entitlement, and entitlements are only writable by the trusted server
 *  (Stripe webhook via the service role) — a client can never forge one. Requesters are stored as
 *  a hash, not raw PII. */

export function getPricing(share: PipelineShare): SharePricing {
  return sharePricingSchema.parse(share.pricing ?? {});
}

/** A stable, non-reversible reference for a requester (their email) — never store raw PII we don't need. */
export function hashRef(value: string): string {
  return createHash("sha256").update(`${value.trim().toLowerCase()}::flowmind-share`).digest("hex").slice(0, 40);
}

type EntRow = { id: string; kind: string; runs_remaining: number | null; active_until: string | null };

export async function hasEntitlement(shareId: string, requesterRef: string | undefined): Promise<boolean> {
  if (!requesterRef) return false;
  const sb = getServerSupabase();
  if (!sb) return false;
  const { data } = await sb.from("share_entitlements").select("*").eq("share_id", shareId).eq("requester_ref", requesterRef);
  const now = Date.now();
  return ((data as EntRow[]) ?? []).some(
    (e) =>
      (e.kind === "subscription" && e.active_until != null && new Date(e.active_until).getTime() > now) ||
      (e.kind === "per_run" && (e.runs_remaining ?? 0) > 0),
  );
}

export async function consumeEntitlement(shareId: string, requesterRef: string): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  const { data } = await sb
    .from("share_entitlements")
    .select("*")
    .eq("share_id", shareId)
    .eq("requester_ref", requesterRef)
    .eq("kind", "per_run")
    .gt("runs_remaining", 0)
    .order("created_at", { ascending: true })
    .limit(1);
  const e = ((data as EntRow[]) ?? [])[0];
  if (e) await sb.from("share_entitlements").update({ runs_remaining: (e.runs_remaining ?? 1) - 1 }).eq("id", e.id);
}

/** Create an entitlement on successful payment (Stripe webhook → service role write). */
export async function createEntitlement(
  shareId: string,
  requesterRef: string,
  kind: "per_run" | "subscription",
  opts: { runs?: number; activeUntil?: string } = {},
): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb.from("share_entitlements").insert({
    id: newId("ent"),
    share_id: shareId,
    requester_ref: requesterRef,
    kind,
    runs_remaining: kind === "per_run" ? opts.runs ?? 1 : null,
    active_until: kind === "subscription" ? opts.activeUntil ?? new Date(Date.now() + 30 * 864e5).toISOString() : null,
    created_at: new Date().toISOString(),
  });
}

export async function recordShareRun(
  shareId: string,
  data: { requesterRef?: string; status: string; durationMs?: number; costUsd?: number; inputKeys: string[]; runId?: string },
): Promise<void> {
  const sb = getServerSupabase();
  if (!sb) return;
  await sb
    .from("share_runs")
    .insert({
      id: newId("srun"),
      share_id: shareId,
      requester_ref: data.requesterRef ?? null,
      status: data.status,
      duration_ms: data.durationMs ?? null,
      cost_usd: data.costUsd ?? null,
      input_keys: data.inputKeys,
      run_id: data.runId ?? null,
      created_at: new Date().toISOString(),
    })
    .then(
      () => {},
      () => {},
    );
}
