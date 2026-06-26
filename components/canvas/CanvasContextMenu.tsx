"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, Frame, Link2, Settings2, Trash2 } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { NODE_TYPES } from "@/lib/pipeline/schema";
import { KIND_LABEL, KIND_DESCRIPTION, KIND_ACCENT } from "@/lib/ui/nodeKinds";
import { ACCENT_HEX } from "@/lib/ui/colors";
import { descendantsOf } from "@/lib/pipeline/graph";
import { cn } from "@/lib/ui/cn";

export type CanvasMenu = {
  x: number;
  y: number;
  /** flow-coords drop point for "add node here" (pane menu only) */
  flow: { x: number; y: number } | null;
  /** set when the menu was opened on a node */
  nodeId: string | null;
};

/** Right-click menu for the canvas. On empty canvas: add a node (lands at the click point) +
 *  Fit to view. On a node: connect to a valid target, edit details, or delete. */
export function CanvasContextMenu({
  menu,
  onClose,
  onFit,
}: {
  menu: CanvasMenu;
  onClose: () => void;
  onFit: () => void;
}) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const insertNodeKind = usePipelineStore((s) => s.insertNodeKind);
  const connectNodes = usePipelineStore((s) => s.connectNodes);
  const removeNode = usePipelineStore((s) => s.removeNode);
  const openInspector = usePipelineStore((s) => s.openInspector);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const [connecting, setConnecting] = useState(false);

  // Keep the menu fully on-screen (flip near edges).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(menu.x, window.innerWidth - r.width - 8);
    const y = Math.min(menu.y, window.innerHeight - r.height - 8);
    setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [menu.x, menu.y, connecting]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const node = menu.nodeId ? pipeline?.nodes.find((n) => n.id === menu.nodeId) : null;

  // Valid connection targets from this node: not self, not already wired, not an input,
  // and not one that would close a loop.
  const targets =
    node && pipeline
      ? pipeline.nodes.filter((n) => {
          if (n.id === node.id || n.type === "input") return false;
          if (pipeline.edges.some((e) => e.source === node.id && e.target === n.id)) return false;
          if (descendantsOf(pipeline, n.id).has(node.id)) return false;
          return true;
        })
      : [];

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-[232px] rounded-xl p-1.5 glass-strong shadow-[0_16px_48px_rgba(0,0,0,0.6)] fm-fade-up"
      onContextMenu={(e) => e.preventDefault()}
    >
      {!node ? (
        <>
          <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">Add node</p>
          {NODE_TYPES.map((k) => (
            <button
              key={k}
              onClick={() => {
                insertNodeKind(k, menu.flow ?? undefined);
                onClose();
              }}
              title={KIND_DESCRIPTION[k]}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT_HEX[KIND_ACCENT[k]] }} />
              <span className="flex-1">{KIND_LABEL[k]}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            onClick={() => {
              onFit();
              onClose();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1]"
          >
            <Frame size={13} className="shrink-0" /> Fit to view
          </button>
        </>
      ) : connecting ? (
        <>
          <button
            onClick={() => setConnecting(false)}
            className="mb-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] text-ink-faint transition hover:text-ink"
          >
            <ChevronRight size={12} className="rotate-180" /> Connect to…
          </button>
          <div className="max-h-[260px] overflow-y-auto">
            {targets.length === 0 ? (
              <p className="px-2 py-2 text-[11.5px] leading-relaxed text-ink-faint">No valid targets — every other node is already wired or would form a loop.</p>
            ) : (
              targets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    connectNodes(node.id, t.id);
                    onClose();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1]"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="ml-auto shrink-0 text-[10px] capitalize text-ink-faint">{t.type}</span>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="truncate px-2 pb-1 pt-1 text-[11px] font-medium text-ink">{node.title}</div>
          <button
            onClick={() => setConnecting(true)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1]"
          >
            <Link2 size={13} className="shrink-0" /> <span className="flex-1">Connect to →</span>
          </button>
          <button
            onClick={() => {
              selectNode(node.id);
              openInspector(node.id);
              onClose();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1]"
          >
            <Settings2 size={13} className="shrink-0" /> Edit details
          </button>
          <div className="my-1 h-px bg-line" />
          <button
            onClick={() => {
              removeNode(node.id);
              onClose();
            }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-red/90 transition hover:bg-red/[0.1] hover:text-red active:bg-red/[0.16]",
            )}
          >
            <Trash2 size={13} className="shrink-0" /> Delete node
          </button>
        </>
      )}
    </div>
  );
}
