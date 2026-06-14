"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

type EstimateLine = { label: string; credits: number; reason?: string };
type EstimateResponse = {
  estimate: { credits: number; breakdown: EstimateLine[]; warnings?: string[] };
  gate: { allowed: boolean; softWarning?: string; reason?: string };
  billingEnabled: boolean;
  creditsAvailable: number;
};

export type EstimateRequest =
  | { kind: "run"; pipeline: unknown; onlyNodeId?: string }
  | { kind: "input_studio"; config: { rowCount?: number; qualityTarget?: string; generationStyle?: string } }
  | { kind: "export"; modes: string[]; regenerateDocs?: boolean; githubPr?: boolean };

/** Compact "estimated cost before running" widget. Renders nothing when billing is off or the
 *  estimate is zero, so it never adds noise to the free/demo experience. */
export function CreditEstimate({ request, compact }: { request: EstimateRequest; compact?: boolean }) {
  const [data, setData] = useState<EstimateResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/credits/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(request)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !data.billingEnabled || data.estimate.credits <= 0) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
        <Zap size={11} className="text-gold" /> ~{data.estimate.credits} credits
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-2.5 text-[11.5px]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-ink">
          <Zap size={12} className="text-gold" /> Estimated: {data.estimate.credits} credits
        </span>
        <span className="text-[10.5px] text-ink-faint">{data.creditsAvailable} available</span>
      </div>
      {data.estimate.breakdown.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {data.estimate.breakdown.slice(0, 4).map((b, i) => (
            <div key={i} className="flex items-center justify-between text-[10.5px] text-ink-dim">
              <span className="truncate">{b.label}</span>
              <span className="text-ink-faint">{b.credits}</span>
            </div>
          ))}
        </div>
      )}
      {(data.estimate.warnings?.[0] || data.gate.softWarning) && (
        <p className="mt-1.5 text-[10.5px] text-gold">{data.estimate.warnings?.[0] ?? data.gate.softWarning}</p>
      )}
    </div>
  );
}
