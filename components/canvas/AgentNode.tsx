"use client";

import { createElement, memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";
import type { PipelineNode } from "@/lib/pipeline/schema";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

function AgentNodeImpl({ data, selected }: NodeProps) {
  const node = data as unknown as PipelineNode;
  const sourceBadge = (data as { sourceBadge?: { label: string; meta: string } }).sourceBadge;
  const controllerKind = (data as { controllerKind?: string }).controllerKind;
  const dropTarget = (data as { dropTarget?: boolean }).dropTarget;
  const accent = hexFor({ color: node.color, type: node.type });
  const icon = iconForNode(node);
  const status = node.status;

  const ring = dropTarget
    ? `0 0 0 2px ${accent}, 0 0 30px ${withAlpha(accent, 0.55)}`
    : status === "running"
      ? `0 0 0 1.5px ${accent}, 0 0 26px ${withAlpha(accent, 0.45)}`
      : status === "success"
        ? `0 0 0 1px ${withAlpha(accent, 0.65)}, 0 0 20px ${withAlpha(accent, 0.18)}`
        : status === "error"
          ? `0 0 0 1.5px #f87171, 0 0 22px rgba(248,113,113,0.4)`
          : selected
            ? `0 0 0 1px ${withAlpha(accent, 0.5)}`
            : "0 8px 30px rgba(0,0,0,0.45)";

  return (
    <div
      className={cn("fm-node group relative w-[232px] rounded-2xl p-[14px] glass", status === "running" && "fm-running")}
      style={{
        // @ts-expect-error css var
        "--accent": accent,
        boxShadow: ring,
        borderColor: status === "idle" && !selected ? undefined : withAlpha(accent, 0.5),
        background: `linear-gradient(180deg, ${withAlpha(accent, 0.06)}, rgba(10,10,18,0.72))`,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: withAlpha(accent, 0.16), color: accent, boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.3)}` }}
        >
          {createElement(icon, { size: 17, strokeWidth: 1.9 })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[13.5px] font-medium leading-tight text-ink">{node.title}</h3>
            {node.team ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-md px-1 py-[1px] text-[9px] font-medium"
                style={{ background: withAlpha(accent, 0.16), color: accent }}
                title={`Team · ${node.team.strategy}`}
              >
                <Users size={9} /> {node.team.agents.length || "team"}
              </span>
            ) : controllerKind ? (
              <span
                className="rounded-md px-1 py-[1px] text-[9px] font-medium capitalize"
                style={{ background: withAlpha(accent, 0.16), color: accent }}
                title={`Team controller · ${controllerKind}`}
              >
                {controllerKind}
              </span>
            ) : null}
          </div>
          <p className="mt-[3px] text-[11px] leading-snug text-ink-dim line-clamp-2">
            {node.description || node.subtitle || node.role}
          </p>
        </div>
        <StatusDot status={status} accent={accent} />
      </div>

      {sourceBadge && (
        <div className="mt-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-[2px] text-[10px] font-medium"
            style={{ background: withAlpha(accent, 0.12), color: withAlpha(accent, 0.95) }}
            title={`Source · ${sourceBadge.label}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            {sourceBadge.label}
            {sourceBadge.meta ? <span className="text-ink-faint">· {sourceBadge.meta}</span> : null}
          </span>
        </div>
      )}

      {node.outputs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {node.outputs.slice(0, 3).map((o) => (
            <span
              key={o}
              className="rounded-md px-1.5 py-[2px] font-mono text-[10px]"
              style={{ background: withAlpha(accent, 0.12), color: withAlpha(accent, 0.95) }}
            >
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status, accent }: { status: PipelineNode["status"]; accent: string }) {
  const color = status === "error" ? "#f87171" : accent;
  if (status === "idle")
    return <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#ffffff22" }} />;
  return (
    <span className="relative mt-1 flex h-2 w-2 shrink-0">
      {status === "running" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: color }} />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
    </span>
  );
}

export const AgentNode = memo(AgentNodeImpl);
