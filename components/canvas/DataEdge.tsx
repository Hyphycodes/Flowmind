"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

type EdgeData = { color?: string; label?: string; animated?: boolean; contractColor?: string };

export function DataEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.32,
  });
  const d = (data ?? {}) as EdgeData;
  const color = d.color ?? "#8b5cf6";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: 1.6,
          opacity: d.animated ? 0.95 : 0.6,
          filter: `drop-shadow(0 0 5px ${color}55)`,
        }}
        className={d.animated ? "fm-edge-animated" : undefined}
      />
      {d.label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-md px-1.5 py-[2px] font-mono text-[10px] glass"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color,
              borderColor: `${color}55`,
            }}
          >
            {d.contractColor ? (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: d.contractColor, boxShadow: `0 0 6px ${d.contractColor}` }}
                title="Data contract status"
              />
            ) : null}
            {d.label}
          </div>
        </EdgeLabelRenderer>
      ) : d.contractColor ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title="Data contract status"
          >
            <span
              className="block h-2 w-2 rounded-full"
              style={{ background: d.contractColor, boxShadow: `0 0 6px ${d.contractColor}` }}
            />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
