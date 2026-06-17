"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LimitVal = number | "unlimited";
type Counter = { used: number; limit: LimitVal };

type Usage = {
  billingEnabled: boolean;
  planId: string;
  planName: string;
  creditsRemaining: number;
  includedCredits: number;
  realRuns: Counter;
  edits: Counter;
  exports: Counter;
  githubPrExports: Counter;
  inputStudioRows: Counter;
  periodEnd: string;
};

const ACCENT = { credits: "#8b5cf6", runs: "#4f8bff", edits: "#22d3ee", exports: "#2dd4bf" };

function pct(used: number, limit: LimitVal): number {
  if (limit === "unlimited" || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function fmtReset(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/** Calm sidebar usage meter. Replaces the old hardcoded card; fetches real usage and degrades to
 *  a friendly default when billing is off. Never noisy. */
export function UsageMeter() {
  const [u, setU] = useState<Usage | null>(null);

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then(setU)
      .catch(() => setU(null));
  }, []);

  if (!u) {
    return (
      <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
        <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1 animate-pulse rounded-full bg-white/[0.05]" />
          ))}
        </div>
      </div>
    );
  }

  const creditsPct = u.includedCredits ? Math.min(100, Math.round((u.creditsRemaining / u.includedCredits) * 100)) : 100;

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink">{u.planName} Plan</span>
        <Link href="/settings/billing" className="text-[11px] text-violet hover:underline">
          {u.planId === "free" ? "Upgrade" : "Manage"}
        </Link>
      </div>
      <div className="mt-3 space-y-2.5">
        <Meter
          label="Credits"
          value={`${u.creditsRemaining.toLocaleString()} left`}
          pct={creditsPct}
          accent={ACCENT.credits}
        />
        <Meter
          label="Runs"
          value={u.realRuns.limit === "unlimited" ? `${u.realRuns.used}` : `${u.realRuns.used} / ${u.realRuns.limit}`}
          pct={pct(u.realRuns.used, u.realRuns.limit)}
          accent={ACCENT.runs}
        />
        <Meter
          label="Edits"
          value={u.edits.limit === "unlimited" ? `${u.edits.used}` : `${u.edits.used} / ${u.edits.limit}`}
          pct={pct(u.edits.used, u.edits.limit)}
          accent={ACCENT.edits}
        />
        <Meter
          label="Exports"
          value={u.exports.limit === "unlimited" ? `${u.exports.used}` : `${u.exports.used} / ${u.exports.limit}`}
          pct={pct(u.exports.used, u.exports.limit)}
          accent={ACCENT.exports}
        />
      </div>
      <div className="mt-2.5 text-[10px] text-ink-faint">
        {u.billingEnabled ? `Resets ${fmtReset(u.periodEnd)}` : "Billing off · unlimited preview"}
      </div>
    </div>
  );
}

function Meter({ label, value, pct, accent }: { label: string; value: string; pct: number; accent: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-dim">{label}</span>
        <span className="text-ink-faint">{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}
