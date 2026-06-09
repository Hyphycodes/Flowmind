"use client";

import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { Frame, Hand, Maximize2, Minus, MousePointer2, Plus } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type Tool = "select" | "pan";

export function FloatingCanvasControls({
  tool,
  setTool,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  return (
    <>
      <Panel position="bottom-left" className="!m-4">
        <div className="flex items-center gap-0.5 rounded-xl p-1 glass-strong">
          <IconBtn onClick={() => zoomOut({ duration: 150 })} label="Zoom out">
            <Minus size={15} />
          </IconBtn>
          <span className="w-11 text-center text-xs tabular-nums text-ink-dim">
            {Math.round(zoom * 100)}%
          </span>
          <IconBtn onClick={() => zoomIn({ duration: 150 })} label="Zoom in">
            <Plus size={15} />
          </IconBtn>
          <IconBtn onClick={() => fitView({ padding: 0.25, duration: 400 })} label="Fit view">
            <Frame size={15} />
          </IconBtn>
        </div>
      </Panel>

      <Panel position="bottom-center" className="!mb-[92px]">
        <div className="flex items-center gap-0.5 rounded-2xl p-1 glass-strong">
          <IconBtn active={tool === "select"} onClick={() => setTool("select")} label="Select">
            <MousePointer2 size={15} />
          </IconBtn>
          <IconBtn active={tool === "pan"} onClick={() => setTool("pan")} label="Pan">
            <Hand size={15} />
          </IconBtn>
          <div className="mx-0.5 h-5 w-px bg-line" />
          <IconBtn onClick={() => fitView({ padding: 0.25, duration: 400 })} label="Fit to screen">
            <Maximize2 size={15} />
          </IconBtn>
        </div>
      </Panel>
    </>
  );
}

function IconBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-white/5 hover:text-ink",
        active && "bg-white/8 text-ink",
      )}
    >
      {children}
    </button>
  );
}
