"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

type EdgeData = { color?: string; label?: string; animated?: boolean };

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
            className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md px-1.5 py-[2px] font-mono text-[10px] glass"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color,
              borderColor: `${color}55`,
            }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
