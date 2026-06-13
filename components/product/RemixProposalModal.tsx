"use client";

import { ArrowRight, TriangleAlert, Wand2, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";

const CHANGE_ICON: Record<string, string> = {
  add_node: "+ node",
  remove_node: "− node",
  update_node: "~ node",
  add_edge: "+ edge",
  update_prompt: "~ prompt",
  update_model: "~ model",
  add_tool: "+ tool",
  add_dataset: "+ dataset",
  add_ui_binding: "+ UI",
  update_product_drop: "~ product",
  update_reality_meter: "~ reality",
};

export function RemixProposalModal() {
  const remixing = usePipelineStore((s) => s.remixing);
  const proposal = usePipelineStore((s) => s.remixProposal);
  const applyRemix = usePipelineStore((s) => s.applyRemix);
  const cancelRemix = usePipelineStore((s) => s.cancelRemix);

  if (!remixing || !proposal) return null;
  const impact = proposal.estimatedImpact;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm" onClick={cancelRemix}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fade-up flex max-h-full w-[440px] flex-col overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/15 text-violet">
              <Wand2 size={15} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-ink">{proposal.title}</div>
              <div className="text-[10.5px] text-ink-faint">Proposed changes — nothing is applied yet</div>
            </div>
          </div>
          <button onClick={cancelRemix} className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
          <p className="text-[12.5px] leading-relaxed text-ink-dim">{proposal.summary}</p>

          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-ink-faint">Changes</div>
            {proposal.changes.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5">
                <span className="mt-0.5 shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">
                  {CHANGE_ICON[c.type] ?? c.type}
                </span>
                <span className="text-[11.5px] leading-relaxed text-ink-dim">{c.description}</span>
              </div>
            ))}
          </div>

          {impact && (
            <div className="grid grid-cols-2 gap-2">
              {(["quality", "cost", "speed", "complexity"] as const).map((k) =>
                impact[k] ? (
                  <div key={k} className="rounded-lg border border-line bg-black/20 p-2">
                    <div className="text-[10px] capitalize text-ink-faint">{k}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink">{impact[k]}</div>
                  </div>
                ) : null,
              )}
            </div>
          )}

          {proposal.variationName && (
            <p className="text-[11px] text-ink-faint">
              Saves a product variation: <span className="text-violet">{proposal.variationName}</span>
            </p>
          )}

          {proposal.warnings.length > 0 &&
            proposal.warnings.map((w, i) => (
              <div key={i} className="flex gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] p-2.5 text-[11px] text-ink-dim">
                <TriangleAlert size={13} className="mt-0.5 shrink-0 text-gold" />
                {w}
              </div>
            ))}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <button
            onClick={cancelRemix}
            className="rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-ink-dim transition hover:text-ink"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            onClick={applyRemix}
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90"
          >
            Apply <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
