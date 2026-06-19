"use client";

import { createElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import type { PipelineNode } from "@/lib/pipeline/schema";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";

const TYPE_LABEL: Record<string, string> = {
  input: "Source",
  agent: "Agent",
  tool: "Tool",
  transformer: "Transformer",
  evaluator: "Evaluator",
  output: "Surface",
};

const STATUS: Record<string, { label: string; color: string }> = {
  idle: { label: "Idle", color: "#6f7088" },
  running: { label: "Running", color: "#8b5cf6" },
  success: { label: "Done", color: "#34d399" },
  error: { label: "Error", color: "#f87171" },
};

/** Mobile viewer: tap a node → a bottom sheet with its details. Read-only.
 *  Dismiss by swiping down or tapping the backdrop. Reads the same store
 *  selection the desktop popover uses, so no extra wiring on the canvas. */
export function NodeBottomSheet() {
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const node = (pipeline?.nodes.find((n) => n.id === selectedNodeId) ?? null) as PipelineNode | null;

  const accent = node ? hexFor({ color: node.color, type: node.type }) : "#8b5cf6";
  const Icon = node ? iconForNode(node) : null;
  const status = node ? STATUS[node.status] ?? STATUS.idle : STATUS.idle;
  const prompt = node ? (node as { prompt?: string }).prompt : undefined;

  return (
    <AnimatePresence>
      {node && Icon && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => selectNode(null)}
          />
          <motion.div
            role="dialog"
            aria-label={`${node.title} details`}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[72vh] overflow-y-auto rounded-t-3xl border-t border-line bg-[#0c0c14]/95 px-5 pb-9 pt-3 backdrop-blur-xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) selectNode(null);
            }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: withAlpha(accent, 0.16), color: accent, boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.3)}` }}
              >
                {createElement(Icon, { size: 20, strokeWidth: 1.9 })}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[16px] font-semibold text-ink">{node.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md px-1.5 py-[2px] text-[10.5px] font-medium" style={{ background: withAlpha(accent, 0.14), color: accent }}>
                    {TYPE_LABEL[node.type] ?? node.type}
                  </span>
                  {node.team ? (
                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[10.5px] font-medium" style={{ background: withAlpha(accent, 0.14), color: accent }}>
                      <Users size={10} /> {node.team.agents.length} · {node.team.strategy}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
                    <span className="h-2 w-2 rounded-full" style={{ background: status.color, boxShadow: `0 0 6px ${status.color}` }} />
                    {status.label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => selectNode(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition hover:bg-white/[0.06] hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {(node.description || node.subtitle || node.role) && (
              <p className="mt-4 text-[13.5px] leading-relaxed text-ink-dim">
                {node.description || node.subtitle || node.role}
              </p>
            )}

            {prompt ? (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Prompt</div>
                <p className="line-clamp-5 rounded-xl border border-line bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-ink-dim">
                  {prompt}
                </p>
              </div>
            ) : null}

            {node.outputs.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Outputs</div>
                <div className="flex flex-wrap gap-1.5">
                  {node.outputs.map((o) => (
                    <span key={o} className="rounded-md px-2 py-1 font-mono text-[11px]" style={{ background: withAlpha(accent, 0.12), color: withAlpha(accent, 0.95) }}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
