"use client";

/** Section 2 — the Import differentiator. A real-looking repo tree drops in,
 *  then recedes as the same system rewires itself into a live pipeline graph.
 *  Pinned + scroll-scrubbed with Framer (sticky stage + useScroll) — no GSAP.
 *  Reduced motion → a calm static end-state, no pinning. */

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ChevronDown, FileCode2, Folder } from "lucide-react";
import { DOT_FIELD, LandingNode, edgePath, type EdgeSpec, type GraphNodeSpec } from "./graph";
import { stageWidth, useInViewOnce, useMeasuredWidth } from "./hooks";
import { useIsMobile } from "@/lib/ui/responsive";

const STAGE = { w: 940, h: 430 };

const NODES: GraphNodeSpec[] = [
  { id: "in", title: "Intake", type: "input", color: "blue", desc: "Repo + inputs", x: 60, y: 168, w: 178 },
  { id: "crew", title: "Research Crew", type: "agent", color: "violet", desc: "researcher.ts", team: 4, x: 392, y: 36, w: 188 },
  { id: "score", title: "Deal Scorer", type: "evaluator", color: "gold", desc: "scorer.ts", x: 392, y: 168, w: 188 },
  { id: "writer", title: "Writer", type: "transformer", color: "teal", desc: "writer.ts", x: 392, y: 300, w: 188 },
  { id: "out", title: "Export", type: "output", color: "pink", desc: "bundle.ts", outputs: ["zip"], x: 726, y: 168, w: 178 },
];
const EDGES: EdgeSpec[] = [
  ["in", "crew"],
  ["in", "score"],
  ["in", "writer"],
  ["crew", "out"],
  ["score", "out"],
  ["writer", "out"],
];
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

const TREE: { depth: number; name: string; file?: boolean }[] = [
  { depth: 0, name: "app/" },
  { depth: 1, name: "api/run/route.ts", file: true },
  { depth: 1, name: "editor/page.tsx", file: true },
  { depth: 0, name: "lib/pipeline/" },
  { depth: 1, name: "schema.ts", file: true },
  { depth: 1, name: "architect.ts", file: true },
  { depth: 0, name: "agents/" },
  { depth: 1, name: "researcher.ts", file: true },
  { depth: 1, name: "scorer.ts", file: true },
  { depth: 1, name: "writer.ts", file: true },
];

export function ImportBeat() {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  // Mobile: the wide horizontal stage would shrink to unreadable nodes — stack it
  // vertically instead (tree → pipeline), revealed on scroll-into-view.
  if (isMobile) return <ImportMobile reduce={Boolean(reduce)} />;
  if (reduce) return <ImportStatic />;
  return <ImportScrub />;
}

function Header() {
  return (
    <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-violet">The import edge</span>
      <h2 className="mt-2 font-display text-[30px] italic leading-tight text-ink sm:text-[40px]">
        Already have a system? Drop it in.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-dim">
        Point Flowmind at a codebase and watch it resolve into agents, prompts, and the data flowing between them.
      </p>
    </div>
  );
}

/** Mobile: tree on top, pipeline stacked below, revealed on scroll-into-view.
 *  Full-width readable cards instead of a shrunken horizontal stage. */
function ImportMobile({ reduce }: { reduce: boolean }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  const show = reduce || seen;
  const rise = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: show ? { opacity: 1, y: 0 } : undefined,
          transition: { duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
        };
  return (
    <section id="import" className="px-5 py-20 sm:px-8">
      <Header />
      <div ref={ref} className="mx-auto mt-8 flex w-full max-w-[320px] flex-col">
        <motion.div {...rise(0)} className="rounded-2xl p-3 glass">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[10.5px] font-medium text-ink-dim">
            <Folder size={12} className="text-violet" /> your-repo
          </div>
          <div className="space-y-[3px]">
            {TREE.map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-[3px] font-mono text-[11px] text-ink-dim"
                style={{ paddingLeft: 8 + row.depth * 14 }}
              >
                {row.file ? <FileCode2 size={11} className="shrink-0 text-ink-faint" /> : <Folder size={11} className="shrink-0 text-violet/80" />}
                <span className={row.file ? "" : "text-ink"}>{row.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <MobileConnector p={rise(1)} />

        {NODES.map((n, i) => (
          <div key={n.id}>
            {i > 0 ? <MobileConnector p={rise(2 + i)} /> : null}
            <motion.div {...rise(2 + i)}>
              <LandingNode spec={n} state="done" fluid />
            </motion.div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-7 max-w-xs text-center text-[13px] text-ink">
        Every agent, every prompt, every data flow — visible.
      </p>
    </section>
  );
}

function MobileConnector({ p }: { p: object }) {
  return (
    <motion.div {...p} className="flex flex-col items-center py-1.5" aria-hidden>
      <span className="h-4 w-px bg-gradient-to-b from-violet/10 to-violet/60" />
      <ChevronDown size={13} className="-mt-0.5 text-violet/70" />
    </motion.div>
  );
}

function ImportScrub() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [stageRef, rawWidth] = useMeasuredWidth<HTMLDivElement>();
  const width = stageWidth(rawWidth);
  const scale = width > 0 ? Math.min(1, width / STAGE.w) : 0;

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  // Clean handoff: the tree fully recedes BEFORE the graph solidifies (so they
  // never share a muddy mid-opacity), edges finish early, then the completed
  // pipeline holds crisp for the rest of the (tall) section before it scrolls off.
  const treeOpacity = useTransform(scrollYProgress, [0, 0.18, 0.34], [1, 1, 0]);
  const treeScale = useTransform(scrollYProgress, [0, 0.34], [1, 0.92]);
  const treeX = useTransform(scrollYProgress, [0, 0.34], [0, -30]);
  const graphOpacity = useTransform(scrollYProgress, [0.34, 0.5], [0, 1]);
  const edgeDraw = useTransform(scrollYProgress, [0.5, 0.74], [0, 1]);
  const captionShift = useTransform(scrollYProgress, [0.46, 0.6], [0, 1]);
  const preCaptionOpacity = useTransform(captionShift, [0, 1], [1, 0]);

  return (
    <section id="import">
      <div ref={sectionRef} className="relative h-[320vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden py-10">
        <Header />
        <div ref={stageRef} className="relative mt-8 w-full max-w-5xl px-5 sm:px-8">
          <div className="relative mx-auto" style={{ height: scale ? STAGE.h * scale : 360, width: "100%" }}>
            {scale > 0 ? (
              <div
                className="absolute left-1/2 top-0"
                style={{ width: STAGE.w, height: STAGE.h, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
              >
                <div className="absolute inset-0 rounded-3xl border border-line" style={DOT_FIELD} />

                {/* Repo tree */}
                <motion.div
                  className="absolute left-[44px] top-[64px] w-[260px] rounded-2xl p-3 glass"
                  style={{ opacity: treeOpacity, scale: treeScale, x: treeX }}
                >
                  <div className="mb-2 flex items-center gap-1.5 px-1 text-[10.5px] font-medium text-ink-dim">
                    <Folder size={12} className="text-violet" /> your-repo
                  </div>
                  <div className="space-y-[3px]">
                    {TREE.map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center gap-1.5 rounded-md px-1.5 py-[3px] font-mono text-[11px] text-ink-dim"
                        style={{ paddingLeft: 8 + row.depth * 14 }}
                      >
                        {row.file ? <FileCode2 size={11} className="shrink-0 text-ink-faint" /> : <Folder size={11} className="shrink-0 text-violet/80" />}
                        <span className={row.file ? "" : "text-ink"}>{row.name}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Resolved pipeline */}
                <motion.div className="absolute inset-0" style={{ opacity: graphOpacity }}>
                  <ScrubEdges draw={edgeDraw} />
                  {NODES.map((n) => (
                    <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: n.w }}>
                      <LandingNode spec={n} state="done" />
                    </div>
                  ))}
                </motion.div>
              </div>
            ) : null}
          </div>

          <div className="relative mx-auto mt-6 h-6 max-w-md text-center text-[13.5px]">
            <motion.span className="absolute inset-x-0 text-ink-dim" style={{ opacity: preCaptionOpacity }}>
              <span className="font-mono text-ink-faint">10 files</span> · a system you can&apos;t see into
            </motion.span>
            <motion.span className="absolute inset-x-0 text-ink" style={{ opacity: captionShift }}>
              Every agent, every prompt, every data flow — visible.
            </motion.span>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

function ScrubEdges({ draw }: { draw: MotionValue<number> }) {
  return (
    <svg className="pointer-events-none absolute inset-0" width={STAGE.w} height={STAGE.h} viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} fill="none">
      {EDGES.map(([from, to]) => {
        const a = byId[from];
        const b = byId[to];
        const d = edgePath(a, b);
        return (
          <motion.path
            key={`${from}-${to}`}
            d={d}
            stroke="#8b5cf6"
            strokeWidth={1.6}
            strokeLinecap="round"
            style={{ pathLength: draw, opacity: 0.6, filter: "drop-shadow(0 0 5px rgba(139,92,246,0.45))" }}
          />
        );
      })}
    </svg>
  );
}

/** Reduced-motion: no scroll-jacking — just show the resolved graph, calmly. */
function ImportStatic() {
  const [stageRef, rawWidth] = useMeasuredWidth<HTMLDivElement>();
  const width = stageWidth(rawWidth);
  const scale = width > 0 ? Math.min(1, width / STAGE.w) : 0;
  return (
    <section id="import" className="px-5 py-24 sm:px-8">
      <Header />
      <div ref={stageRef} className="mx-auto mt-10 w-full max-w-5xl">
        <div className="relative mx-auto" style={{ height: scale ? STAGE.h * scale : 360, width: "100%" }}>
          {scale > 0 ? (
            <div
              className="absolute left-1/2 top-0"
              style={{ width: STAGE.w, height: STAGE.h, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
            >
              <div className="absolute inset-0 rounded-3xl border border-line" style={DOT_FIELD} />
              <svg className="pointer-events-none absolute inset-0" width={STAGE.w} height={STAGE.h} viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} fill="none">
                {EDGES.map(([from, to]) => (
                  <path key={`${from}-${to}`} d={edgePath(byId[from], byId[to])} stroke="#8b5cf6" strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
                ))}
              </svg>
              {NODES.map((n) => (
                <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: n.w }}>
                  <LandingNode spec={n} state="done" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <p className="mx-auto mt-6 max-w-md text-center text-[13.5px] text-ink">Every agent, every prompt, every data flow — visible.</p>
      </div>
    </section>
  );
}
