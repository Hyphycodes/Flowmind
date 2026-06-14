"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";

type Level = "pass" | "warn" | "fail";
type Check = { id: string; label: string; level: Level; detail: string };
type Readiness = { verdict: Level; checks: Check[]; summary: { pass: number; warn: number; fail: number } };

const META: Record<Level, { color: string; icon: typeof CheckCircle2; label: string }> = {
  pass: { color: "#34d399", icon: CheckCircle2, label: "Pass" },
  warn: { color: "#f5c451", icon: TriangleAlert, label: "Warn" },
  fail: { color: "#f87171", icon: XCircle, label: "Fail" },
};

/** Internal beta-readiness panel. Shows pass/warn/fail per subsystem. Configured/missing only —
 *  never secret values. */
export default function ReadinessPage() {
  const [data, setData] = useState<Readiness | null>(null);

  useEffect(() => {
    fetch("/api/status/readiness")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <PageShell title="Beta Readiness" subtitle="Production self-check — configuration & safety posture">
      <div className="max-w-2xl space-y-4">
        {!data ? (
          <div className="flex items-center gap-2 text-[12px] text-ink-faint">
            <Loader2 size={13} className="animate-spin" /> Running checks…
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-3 rounded-2xl border p-4"
              style={{ borderColor: `${META[data.verdict].color}55`, background: `${META[data.verdict].color}10` }}
            >
              {data.verdict === "pass" ? (
                <ShieldCheck size={22} style={{ color: META[data.verdict].color }} />
              ) : (
                <ShieldAlert size={22} style={{ color: META[data.verdict].color }} />
              )}
              <div>
                <div className="text-[14px] font-semibold text-ink">
                  {data.verdict === "pass" ? "Ready for beta" : data.verdict === "warn" ? "Beta-ready with warnings" : "Not ready — has failures"}
                </div>
                <div className="text-[11.5px] text-ink-faint">
                  {data.summary.pass} pass · {data.summary.warn} warn · {data.summary.fail} fail
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {data.checks.map((c) => {
                const m = META[c.level];
                const Icon = m.icon;
                return (
                  <div key={c.id} className="flex items-start gap-2.5 rounded-xl border border-line bg-white/[0.02] p-3">
                    <Icon size={15} style={{ color: m.color }} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink">{c.label}</div>
                      <div className="text-[11.5px] text-ink-dim">{c.detail}</div>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: m.color, background: `${m.color}1a` }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] leading-relaxed text-ink-faint">
              This panel reports configuration + safety posture only — never secret values. See{" "}
              <code className="font-mono">docs/PRODUCTION_CHECKLIST.md</code> and{" "}
              <code className="font-mono">docs/BETA_READINESS.md</code> for the full pre-launch checklist.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
