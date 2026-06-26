"use client";

import { createElement } from "react";
import { Loader2, RotateCw, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";
import { SourceLayer } from "./SourceLayer";
import { ModelPicker } from "@/components/models/ModelPicker";
import { ToolAttachPanel } from "@/components/tools/ToolAttachPanel";

/** Advanced settings for a node — opened from the popover's "Edit details" button,
 *  not on single click. Prompt editing + team internals live elsewhere (popover +
 *  the zoomed-in team canvas); this panel is models, tools, source, and I/O. */
export function NodeInspector() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedId = usePipelineStore((s) => s.selectedNodeId);
  const inspectorOpen = usePipelineStore((s) => s.inspectorOpen);
  const node = pipeline?.nodes.find((n) => n.id === selectedId) ?? null;

  if (!node || !inspectorOpen) return null;
  return <NodeInspectorPanel key={node.id} node={node} />;
}

function NodeInspectorPanel({ node }: { node: NonNullable<ReturnType<typeof usePipelineStore.getState>["pipeline"]>["nodes"][number] }) {
  const closeInspector = usePipelineStore((s) => s.closeInspector);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const rerunTeam = usePipelineStore((s) => s.rerunTeam);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const patchNode = usePipelineStore((s) => s.patchNode);

  const accent = hexFor({ color: node.color, type: node.type });
  const icon = iconForNode(node);

  return (
    // Tamed floating panel (Prompt 06 Tier 1): pinned top-right, constrained to the viewport
    // height with its own internal scroll so long content (Source Layer, Re-run, etc.) is always
    // reachable and never cut off at the bottom on short windows.
    <div className="absolute right-5 top-5 z-30 max-h-[calc(100dvh-2.5rem)] w-[320px] overflow-y-auto overscroll-contain rounded-2xl p-4 glass-strong fm-fade-up shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: withAlpha(accent, 0.16), color: accent }}
        >
          {createElement(icon, { size: 17, strokeWidth: 1.9 })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{node.title}</div>
          <div className="text-[11px] capitalize text-ink-faint">
            {node.type}
            {node.role ? ` · ${node.role}` : ""}
          </div>
        </div>
        <button
          onClick={() => closeInspector()}
          className="text-ink-faint transition hover:text-ink"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-ink-faint">Model</span>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-ink-dim">{node.model}</span>
      </div>

      <ModelPicker
        node={node}
        value={node.modelSelection}
        onChange={(modelSelection, model) => patchNode(node.id, { modelSelection, model })}
      />

      <ToolAttachPanel node={node} onChange={(toolAttachments) => patchNode(node.id, { toolAttachments })} />

      {(node.inputs.length > 0 || node.outputs.length > 0) && (
        <div className="mt-3 space-y-2">
          <ChipRow label="Inputs" items={node.inputs} accent={accent} dim />
          <ChipRow label="Outputs" items={node.outputs} accent={accent} />
        </div>
      )}

      {(node.source || node.layer === "source" || node.type === "input" || node.type === "tool") && (
        <SourceLayer node={node} />
      )}

      <button
        type="button"
        onClick={() => void (node.team ? rerunTeam(node.id) : runPipeline({ onlyNodeId: node.id }))}
        disabled={runStatus === "running"}
        title={node.team ? "Runs this team with latest available upstream input" : "Runs this node"}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-white/[0.04] py-2 text-[13px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
      >
        {runStatus === "running" ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
        {node.team ? "Re-run team" : "Re-run node"}
      </button>
    </div>
  );
}

function ChipRow({ label, items, accent, dim }: { label: string; items: string[]; accent: string; dim?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-12 shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span
            key={i}
            className="rounded-md px-1.5 py-[2px] font-mono text-[10px]"
            style={{ background: dim ? "#ffffff0d" : withAlpha(accent, 0.12), color: dim ? "#a6a7ba" : accent }}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
