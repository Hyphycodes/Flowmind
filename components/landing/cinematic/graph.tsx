"use client";

/** Lightweight, faithful recreations of the real canvas node + edge language
 *  ([AgentNode]/[DataEdge]) for the marketing hero. NOT React Flow — a scripted
 *  mock (Linear-style) so we control timing and keep it light. Visual tokens are
 *  copied 1:1 from components/canvas/AgentNode.tsx + DataEdge.tsx so it reads as
 *  the actual app. Colors/icons come straight from the real lib helpers. */

import { createElement } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users } from "lucide-react";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

/** The real canvas backdrop: React Flow BackgroundVariant.Dots (gap 26, #ffffff14). */
export const DOT_FIELD: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, #ffffff14 1px, transparent 1px)",
  backgroundSize: "26px 26px",
};

export type NodeState = "idle" | "running" | "done";

export type GraphNodeSpec = {
  id: string;
  title: string;
  role?: string;
  desc?: string;
  type: "input" | "agent" | "tool" | "transformer" | "evaluator" | "output";
  color?: string;
  outputs?: string[];
  team?: number; // agent count → renders the team strip + badge
  // px box on the fixed stage (see HeroGraph stage dimensions)
  x: number;
  y: number;
  w: number;
};

export const NODE_H = 86;

/** Presentational node — mirrors AgentNode's glass card, accent gradient, icon
 *  tile, status dot, team badge and output pills. `state` drives the status glow. */
export function LandingNode({
  spec,
  state = "idle",
  fluid = false,
}: {
  spec: GraphNodeSpec;
  state?: NodeState;
  /** Stretch to the container width instead of the fixed stage px (mobile stacks). */
  fluid?: boolean;
}) {
  const accent = hexFor({ color: spec.color, type: spec.type });
  const Icon = iconForNode(spec);

  const ring =
    state === "running"
      ? `0 0 0 1.5px ${accent}, 0 0 26px ${withAlpha(accent, 0.45)}`
      : state === "done"
        ? `0 0 0 1px ${withAlpha(accent, 0.65)}, 0 0 22px ${withAlpha(accent, 0.2)}`
        : "0 8px 30px rgba(0,0,0,0.45)";

  return (
    <div
      className={cn(
        "fm-node group relative rounded-2xl p-[14px] glass",
        state === "running" && "fm-running",
      )}
      style={{
        width: fluid ? "100%" : spec.w,
        // @ts-expect-error css var consumed by globals.css
        "--accent": accent,
        boxShadow: ring,
        borderColor: state === "idle" ? undefined : withAlpha(accent, 0.5),
        background: `linear-gradient(180deg, ${withAlpha(accent, 0.06)}, rgba(10,10,18,0.72))`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: withAlpha(accent, 0.16),
            color: accent,
            boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.3)}`,
          }}
        >
          {createElement(Icon, { size: 17, strokeWidth: 1.9 })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[13.5px] font-medium leading-tight text-ink">{spec.title}</h3>
            {spec.team ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-md px-1 py-[1px] text-[9px] font-medium"
                style={{ background: withAlpha(accent, 0.16), color: accent }}
              >
                <Users size={9} /> {spec.team}
              </span>
            ) : null}
          </div>
          <p className="mt-[3px] line-clamp-2 text-[11px] leading-snug text-ink-dim">
            {spec.desc || spec.role}
          </p>
        </div>
        <StatusDot state={state} accent={accent} />
      </div>

      {spec.team ? (
        <div className="mt-2.5 flex gap-1">
          {Array.from({ length: 3 }).map((_, d) => (
            <span key={d} className="h-1 flex-1 rounded-full" style={{ background: withAlpha(accent, 0.4) }} />
          ))}
        </div>
      ) : null}

      {spec.outputs && spec.outputs.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {spec.outputs.slice(0, 3).map((o) => (
            <span
              key={o}
              className="rounded-md px-1.5 py-[2px] font-mono text-[10px]"
              style={{ background: withAlpha(accent, 0.12), color: withAlpha(accent, 0.95) }}
            >
              {o}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusDot({ state, accent }: { state: NodeState; accent: string }) {
  if (state === "idle")
    return <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#ffffff22" }} />;
  return (
    <span className="relative mt-1 flex h-2 w-2 shrink-0">
      {state === "running" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: accent }} />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
    </span>
  );
}

/* ── Edges ──────────────────────────────────────────────────────────────────
 * Bezier paths drawn in the same fixed px space as the stage, mirroring
 * DataEdge (curvature, violet glow, the fm-edge-animated dash for "live" flow). */

export type EdgeSpec = [from: string, to: string];

export function edgePath(a: GraphNodeSpec, b: GraphNodeSpec): string {
  const acx = a.x + a.w / 2;
  const acy = a.y + NODE_H / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + NODE_H / 2;
  // Connect on whichever axis dominates, so the same helper serves the wide
  // desktop DAG and the vertically-stacked mobile layout.
  if (Math.abs(bcx - acx) >= Math.abs(bcy - acy)) {
    const rightward = bcx >= acx;
    const sx = rightward ? a.x + a.w : a.x;
    const tx = rightward ? b.x : b.x + b.w;
    const dx = Math.max(36, Math.abs(tx - sx) * 0.5) * (rightward ? 1 : -1);
    return `M ${sx} ${acy} C ${sx + dx} ${acy}, ${tx - dx} ${bcy}, ${tx} ${bcy}`;
  }
  const downward = bcy >= acy;
  const sy = downward ? a.y + NODE_H : a.y;
  const ty = downward ? b.y : b.y + NODE_H;
  const dy = Math.max(28, Math.abs(ty - sy) * 0.5) * (downward ? 1 : -1);
  return `M ${acx} ${sy} C ${acx} ${sy + dy}, ${bcx} ${ty - dy}, ${bcx} ${ty}`;
}

/** SVG edge layer for the hero stage. `progress` (0..1) draws the strokes in;
 *  `flowing` toggles the live dash animation once assembled. */
export function EdgeLayer({
  nodes,
  edges,
  w,
  h,
  flowing,
}: {
  nodes: Record<string, GraphNodeSpec>;
  edges: EdgeSpec[];
  w: number;
  h: number;
  flowing: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <svg className="pointer-events-none absolute inset-0" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      {edges.map(([from, to], i) => {
        const a = nodes[from];
        const b = nodes[to];
        if (!a || !b) return null;
        const accent = hexFor({ color: b.color, type: b.type });
        const d = edgePath(a, b);
        return (
          <g key={`${from}-${to}`}>
            <motion.path
              d={d}
              stroke={accent}
              strokeWidth={1.6}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${withAlpha(accent, 0.45)})`, opacity: 0.6 }}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.6 }}
              transition={{ duration: 0.7, delay: reduce ? 0 : 0.5 + i * 0.14, ease: "easeInOut" }}
            />
            {flowing && !reduce ? (
              <path
                d={d}
                stroke={accent}
                strokeWidth={1.6}
                strokeLinecap="round"
                className="fm-edge-animated"
                style={{ opacity: 0.9, filter: `drop-shadow(0 0 6px ${accent})` }}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
