"use client";

/** Section 3 — bento feature grid. Uneven tiles, each with a small REAL micro-
 *  animation built from Flowmind's tokens (no screenshots, no AI imagery).
 *  Tiles stagger up on scroll-in; hovering a tile lifts it and speeds its motion. */

import { createElement, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Boxes, Eye, Gauge, Package, Sparkles, Table2, Users } from "lucide-react";
import { withAlpha } from "@/lib/ui/colors";
import { cn } from "@/lib/ui/cn";
import { useInViewOnce } from "./hooks";

export function Bento() {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
      <div className="max-w-2xl">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-violet">What you get</span>
        <h2 className="mt-2 font-display text-[30px] italic leading-tight text-ink sm:text-[40px]">
          A studio for systems you can read.
        </h2>
      </div>

      <div ref={ref} className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Tile seen={seen} i={0} className="lg:col-span-3 lg:row-span-2" icon={Eye} title="See what each agent did" body="Per-node cost and latency, right on the canvas — the real 'what caused what.'">
          <AgentTraceViz />
        </Tile>
        <Tile seen={seen} i={1} className="lg:col-span-3" icon={Table2} title="Real runs, real outputs" body="Runs fill structured output tables you can inspect — not mocked results.">
          <TableViz />
        </Tile>
        <Tile seen={seen} i={2} className="lg:col-span-2" icon={Users} title="Teams of agents" body="Crews coordinate by strategy for complex systems.">
          <TeamViz />
        </Tile>
        <Tile seen={seen} i={3} className="lg:col-span-1" icon={Boxes} title="Peek the data" body="Click any edge.">
          <EdgeViz />
        </Tile>
        <Tile seen={seen} i={4} className="lg:col-span-3" icon={Sparkles} title="Describe it, build it" body="A sentence becomes a pipeline. Refine by talking.">
          <DescribeViz />
        </Tile>
        <Tile seen={seen} i={5} className="lg:col-span-3" icon={Package} title="Export and own it" body="Runnable packages — developer, client, founder, portable runtime. No lock-in.">
          <ExportViz />
        </Tile>
        <Tile seen={seen} i={6} className="lg:col-span-6" icon={Gauge} title="Command Center" body="Operate a fleet — what's live, what's failing, what's costing money — across every pipeline.">
          <FleetViz />
        </Tile>
      </div>
    </section>
  );
}

function Tile({
  seen,
  i,
  className,
  icon,
  title,
  body,
  children,
}: {
  seen: boolean;
  i: number;
  className?: string;
  icon: typeof Eye;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      onTapStart={() => setHover(true)}
      whileTap={reduce ? undefined : { scale: 0.99 }}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white/[0.02] p-5 transition-all duration-300",
        "hover:-translate-y-1 hover:border-line-strong hover:bg-white/[0.035]",
        "active:border-line-strong active:bg-white/[0.035]",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet/[0.14] text-violet">
          {createElement(icon, { size: 16 })}
        </span>
        <h3 className="text-[14.5px] font-medium text-ink">{title}</h3>
      </div>
      <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-ink-dim">{body}</p>
      <div className="mt-4 flex-1">
        <Boost hover={hover}>{children}</Boost>
      </div>
    </motion.div>
  );
}

/** Provides a `boost` context via data attr so vizzes can speed up on hover. */
function Boost({ hover, children }: { hover: boolean; children: React.ReactNode }) {
  return (
    <div data-boost={hover ? "1" : "0"} className="h-full [--spd:1]" style={{ ["--spd" as string]: hover ? 0.45 : 1 }}>
      {children}
    </div>
  );
}

/* ── small hooks ─────────────────────────────────────────────────────────── */

function useCycle<T>(list: T[], ms: number): T {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % list.length), ms);
    return () => clearInterval(t);
  }, [list.length, ms, reduce]);
  return list[reduce ? 0 : i];
}

/** Typewriter that cycles a list of examples: types one, holds the full
 *  sentence on screen, erases, then moves to the next. Reduced motion shows the
 *  first line statically. */
function useTypedCycle(lines: string[]): string {
  const reduce = useReducedMotion();
  const [text, setText] = useState(lines[0]);
  useEffect(() => {
    if (reduce) {
      setText(lines[0]);
      return;
    }
    let i = 0;
    let pos = 0;
    let phase: "type" | "hold" | "erase" = "type";
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const line = lines[i];
      if (phase === "type") {
        pos += 1;
        setText(line.slice(0, pos));
        if (pos >= line.length) {
          phase = "hold";
          timer = setTimeout(tick, 2800); // keep the full sentence up
        } else {
          timer = setTimeout(tick, 42);
        }
      } else if (phase === "hold") {
        phase = "erase";
        timer = setTimeout(tick, 22);
      } else {
        pos -= 1;
        setText(line.slice(0, Math.max(0, pos)));
        if (pos <= 0) {
          i = (i + 1) % lines.length;
          phase = "type";
          timer = setTimeout(tick, 380);
        } else {
          timer = setTimeout(tick, 18);
        }
      }
    };
    setText("");
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return text;
}

/* ── vizzes ──────────────────────────────────────────────────────────────── */

function Row({ color, label, dur, cost, run }: { color: string; label: string; dur: string; cost: string; run: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas-2/60 px-3 py-2">
      <span className="relative flex h-2 w-2">
        {run && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: color }} />}
        <span className="relative h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      </span>
      <span className="text-[12px] font-medium text-ink">{label}</span>
      <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">{dur}</span>
      <span className="font-mono text-[11px] tabular-nums" style={{ color: withAlpha(color, 0.95) }}>
        {cost}
      </span>
    </div>
  );
}

function AgentTraceViz() {
  const step = useCycle([0, 1, 2, 3], 900);
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <Row color="#8b5cf6" label="Research Crew" dur="1.24s" cost="$0.0042" run={step === 1} />
      <Row color="#f5c451" label="Deal Scorer" dur="0.81s" cost="$0.0019" run={step === 2} />
      <Row color="#ec4899" label="Buyer Pitch" dur="0.66s" cost="$0.0015" run={step === 3} />
      <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-ink-faint">
        <span>3 nodes</span>
        <span className="font-mono tabular-nums text-ink-dim">total $0.0076 · 2.7s</span>
      </div>
    </div>
  );
}

function TableViz() {
  const rows = [
    ["123 Oak St", "82", "A−"],
    ["44 Pine Ave", "67", "B"],
    ["9 Birch Ln", "91", "A"],
  ];
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setN(rows.length);
      return;
    }
    const t = setInterval(() => setN((v) => (v >= rows.length ? 0 : v + 1)), 800);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        <span>lead</span>
        <span>score</span>
        <span>grade</span>
      </div>
      <div className="divide-y divide-line">
        {rows.map((r, i) => (
          <motion.div
            key={r[0]}
            initial={false}
            animate={{ opacity: i < n ? 1 : 0.12, x: i < n ? 0 : -4 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-1.5 text-[12px]"
          >
            <span className="truncate text-ink">{r[0]}</span>
            <span className="font-mono tabular-nums text-cyan">{r[1]}</span>
            <span className="font-mono text-gold">{r[2]}</span>
          </motion.div>
        ))}
      </div>
      <div className="px-3 py-1 text-[10px] text-ink-faint">powered by <span className="text-violet">deals</span> table</div>
    </div>
  );
}

function TeamViz() {
  const strategy = useCycle(["sequential", "parallel", "debate", "vote"], 1500);
  return (
    <div className="rounded-xl border border-violet/30 p-3" style={{ background: "linear-gradient(180deg, rgba(139,92,246,0.08), rgba(10,10,18,0.6))" }}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/20 text-violet">
          <Users size={14} />
        </span>
        <span className="text-[13px] font-medium text-ink">Research Crew</span>
        <motion.span
          key={strategy}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="ml-auto rounded-md bg-violet/15 px-2 py-[2px] font-mono text-[10px] text-violet"
        >
          {strategy}
        </motion.span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {["Comps", "ARV", "Rehab", "Risk"].map((m) => (
          <span key={m} className="flex-1 rounded-md bg-white/[0.04] px-1.5 py-1 text-center text-[10px] text-ink-dim">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function EdgeViz() {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-full min-h-[92px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 92" fill="none" preserveAspectRatio="none">
        <path d="M 8 76 C 70 76, 120 22, 192 22" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" opacity={0.7} className={reduce ? undefined : "fm-edge-animated"} style={{ filter: "drop-shadow(0 0 5px rgba(34,211,238,0.5))" }} />
      </svg>
      <span className="absolute left-0 top-[64px] h-2.5 w-2.5 rounded-full bg-cyan" style={{ boxShadow: "0 0 8px #22d3ee" }} />
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute right-0 top-1 rounded-md border border-cyan/40 bg-canvas-2/80 px-1.5 py-[2px] font-mono text-[10px] text-cyan glass"
      >
        {`{ arv: 312000 }`}
      </motion.div>
    </div>
  );
}

const DESCRIBE_EXAMPLES = [
  "A crew that researches a property and writes a buyer pitch",
  "Summarize support tickets, tag intent, and route the urgent ones",
  "Watch competitor prices and draft a weekly digest",
  "Read a contract, flag risky clauses, and suggest fixes",
  "Turn a transcript into action items and owners",
];

function DescribeViz() {
  const typed = useTypedCycle(DESCRIBE_EXAMPLES);
  return (
    <div className="rounded-xl border border-line bg-canvas-2/60 px-3 py-2.5">
      <div className="flex min-h-[60px] items-start gap-2">
        <Sparkles size={14} className="mt-[2px] shrink-0 text-violet" />
        <p className="font-mono text-[12px] leading-relaxed text-ink">
          {typed}
          <span className="ml-[1px] inline-block h-[14px] w-[7px] translate-y-[2px] animate-pulse bg-violet/80" />
        </p>
      </div>
    </div>
  );
}

function ExportViz() {
  const files = [
    { name: "developer.zip", c: "#8b5cf6" },
    { name: "client-brief.pdf", c: "#22d3ee" },
    { name: "runtime/", c: "#34d399" },
    { name: "api/", c: "#f5c451" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <motion.span
          key={f.name}
          initial={false}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px]"
          style={{ borderColor: withAlpha(f.c, 0.35), color: withAlpha(f.c, 0.95), background: withAlpha(f.c, 0.06) }}
        >
          <Package size={11} /> {f.name}
        </motion.span>
      ))}
    </div>
  );
}

function FleetViz() {
  const items = [
    { name: "lead-router", c: "#34d399", s: "live" },
    { name: "comps-crew", c: "#34d399", s: "live" },
    { name: "pitch-writer", c: "#f5c451", s: "slow" },
    { name: "dispo-bot", c: "#f87171", s: "error" },
    { name: "intake", c: "#34d399", s: "live" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it, i) => (
        <motion.div
          key={it.name}
          initial={false}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
          className="flex items-center gap-2 rounded-lg border border-line bg-canvas-2/50 px-2.5 py-2"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: it.c, boxShadow: `0 0 8px ${it.c}` }} />
          <span className="truncate font-mono text-[11px] text-ink-dim">{it.name}</span>
        </motion.div>
      ))}
    </div>
  );
}
