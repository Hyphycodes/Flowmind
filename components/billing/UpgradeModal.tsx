"use client";

import Link from "next/link";
import { Sparkles, X, Zap } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";

/** Soft upgrade prompt shown when a feature gate blocks an action (out of credits, feature not in
 *  plan, heavy run). Calm and helpful — always offers a non-paywall path out. */
export function UpgradeModal() {
  const gate = usePipelineStore((s) => s.upgradeGate);
  const close = usePipelineStore((s) => s.closeUpgrade);
  const openExport = usePipelineStore((s) => s.openExport);
  if (!gate) return null;

  const planLabel = gate.planRequired ? gate.planRequired[0].toUpperCase() + gate.planRequired.slice(1) : "Pro";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fade-up w-[420px] overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/15 text-violet">
              <Sparkles size={15} />
            </div>
            <div className="text-[13px] font-medium text-ink">{gate.title ?? "Upgrade Flowmind"}</div>
          </div>
          <button onClick={close} className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-ink-dim">{gate.reason ?? gate.upgradeCta ?? "Upgrade to keep going."}</p>

          {(gate.creditsRequired != null || gate.creditsAvailable != null) && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-2.5 text-[12px]">
              <Zap size={14} className="text-gold" />
              <span className="text-ink-dim">
                Needs <span className="font-medium text-ink">{gate.creditsRequired ?? 0}</span> credits ·{" "}
                <span className="text-ink-faint">{gate.creditsAvailable ?? 0} available</span>
              </span>
            </div>
          )}

          {gate.upgradeCta && <p className="text-[11.5px] text-ink-faint">{gate.upgradeCta}.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3">
          <button
            onClick={() => {
              close();
              openExport();
            }}
            className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ink-dim transition hover:text-ink"
          >
            Download ZIP instead
          </button>
          <div className="flex-1" />
          <button onClick={close} className="rounded-lg px-2.5 py-1.5 text-[12px] text-ink-faint transition hover:text-ink">
            Cancel
          </button>
          <Link
            href="/settings/billing"
            onClick={close}
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90"
          >
            <Sparkles size={13} /> See {planLabel} plan
          </Link>
        </div>
      </div>
    </div>
  );
}
