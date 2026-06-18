"use client";

/** The hero centerpiece: the pipeline assembles itself, then a "run" sweep
 *  lights nodes in dependency order — built entirely from the real node/edge
 *  language (graph.tsx). No browser chrome, just the graph alive on the canvas. */

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DOT_FIELD, EdgeLayer, LandingNode, type EdgeSpec, type GraphNodeSpec, type NodeState } from "./graph";
import { stageWidth, useMeasuredWidth } from "./hooks";

const STAGE = { w: 860, h: 460 };
const STAGE_SM = { w: 320, h: 470 };

// Wide DAG (Source → Brain → Surface): intake fans into a research crew + a
// scorer, both synthesize, then a buyer-facing surface.
const FULL: GraphNodeSpec[] = [
  { id: "in", title: "Intake", type: "input", color: "blue", desc: "Lead + property data", x: 6, y: 188, w: 184 },
  { id: "crew", title: "Research Crew", type: "agent", color: "violet", desc: "Comps · ARV · rehab", team: 6, x: 232, y: 36, w: 188 },
  { id: "score", title: "Deal Scorer", type: "evaluator", color: "gold", desc: "Underwrite the deal", outputs: ["score", "grade"], x: 232, y: 300, w: 188 },
  { id: "synth", title: "Synthesis", type: "transformer", color: "teal", desc: "Merge + reconcile", x: 458, y: 170, w: 184 },
  { id: "out", title: "Buyer Pitch", type: "output", color: "pink", desc: "Audience-ready", outputs: ["pitch"], x: 672, y: 170, w: 184 },
];

// Compact, stacked layout for narrow screens — same language, fewer beats.
const COMPACT: GraphNodeSpec[] = [
  { id: "in", title: "Intake", type: "input", color: "blue", desc: "Lead + property data", x: 30, y: 8, w: 260 },
  { id: "crew", title: "Research Crew", type: "agent", color: "violet", desc: "Comps · ARV · rehab", team: 6, x: 30, y: 178, w: 260 },
  { id: "out", title: "Buyer Pitch", type: "output", color: "pink", desc: "Audience-ready", outputs: ["pitch"], x: 30, y: 348, w: 260 },
];

const FULL_EDGES: EdgeSpec[] = [
  ["in", "crew"],
  ["in", "score"],
  ["crew", "synth"],
  ["score", "synth"],
  ["synth", "out"],
];
const COMPACT_EDGES: EdgeSpec[] = [
  ["in", "crew"],
  ["crew", "out"],
];

// Dependency-ordered "run" sweep groups (parallel members light together).
const FULL_SWEEP = [["in"], ["crew", "score"], ["synth"], ["out"]];
const COMPACT_SWEEP = [["in"], ["crew"], ["out"]];

export function HeroGraph() {
  const [ref, rawWidth] = useMeasuredWidth<HTMLDivElement>();
  const width = stageWidth(rawWidth);
  const reduce = useReducedMotion();
  const compact = width > 0 && width < 560;

  const { nodes, edges, sweep, stage } = useMemo(() => {
    const list = compact ? COMPACT : FULL;
    return {
      nodes: list,
      edges: compact ? COMPACT_EDGES : FULL_EDGES,
      sweep: compact ? COMPACT_SWEEP : FULL_SWEEP,
      stage: compact ? STAGE_SM : STAGE,
    };
  }, [compact]);

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const scale = width > 0 ? Math.min(1, width / stage.w) : 0;

  const [assembled, setAssembled] = useState(false);
  const [states, setStates] = useState<Record<string, NodeState>>({});

  // Assembly finishes ~1.9s after enter; reduced motion shows it built at once.
  useEffect(() => {
    if (reduce) {
      setStates(Object.fromEntries(nodes.map((n) => [n.id, "done" as NodeState])));
      setAssembled(true);
      return;
    }
    setAssembled(false);
    setStates({});
    const t = setTimeout(() => setAssembled(true), 1900);
    return () => clearTimeout(t);
  }, [reduce, nodes]);

  // Looping run sweep once assembled (skipped under reduced motion).
  useEffect(() => {
    if (!assembled || reduce) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const runOnce = () => {
      if (cancelled) return;
      setStates({});
      let t = 300;
      sweep.forEach((group) => {
        timers.push(setTimeout(() => setStates((s) => ({ ...s, ...Object.fromEntries(group.map((id) => [id, "running"])) })), t));
        timers.push(setTimeout(() => setStates((s) => ({ ...s, ...Object.fromEntries(group.map((id) => [id, "done"])) })), t + 620));
        t += 760;
      });
      timers.push(setTimeout(runOnce, t + 2400)); // hold, then replay
    };

    runOnce();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers = [];
    };
  }, [assembled, reduce, sweep]);

  return (
    <div ref={ref} className="relative w-full" style={{ height: scale ? stage.h * scale : undefined, minHeight: scale ? undefined : 360 }}>
      {scale > 0 ? (
        <div
          className="absolute left-1/2 top-0 origin-top"
          style={{ width: stage.w, height: stage.h, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
        >
          {/* dot field — the real canvas backdrop */}
          <div className="absolute inset-0 rounded-3xl" style={DOT_FIELD} />
          <EdgeLayer nodes={byId} edges={edges} w={stage.w} h={stage.h} flowing={assembled} />
          {nodes.map((n, i) => (
            <motion.div
              key={n.id}
              className="absolute"
              style={{ left: n.x, top: n.y, width: n.w }}
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: reduce ? 0 : 0.25 + i * 0.13, ease: [0.22, 1, 0.36, 1] }}
            >
              <LandingNode spec={n} state={states[n.id] ?? "idle"} />
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
