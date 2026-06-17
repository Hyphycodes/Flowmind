"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  DollarSign,
  Eye,
  Gauge,
  Package,
  Share2,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

/** The public front door (Task 08). Leads with the two things Flowmind actually wins on:
 *  you can DEBUG it and you OWN it. Honest only — no invented logos, quotes, or metrics. Fully
 *  responsive (this is opened on phones, unlike the canvas editor). */
export function Landing({ signedIn = false, appHref = "/editor" }: { signedIn?: boolean; appHref?: string }) {
  // Primary CTA flips by session (Prompt 15): logged out → Try the demo; logged in → straight to work.
  const primaryLabel = signedIn ? "Open Flowmind" : "Try it now";

  return (
    <div className="flow-canvas min-h-screen overflow-x-hidden text-ink">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <span className="font-display text-[24px] italic leading-none tracking-tight text-ink">flowmind</span>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href={appHref} className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90">
              Open Flowmind <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-[13px] text-ink-dim transition hover:text-ink">
                Log in
              </Link>
              <Link href="/try" className="rounded-lg bg-violet px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90">
                Try it now
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero — lead with the hook; category is the subhead (Prompt 16) */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-10 pt-10 sm:px-8 lg:grid-cols-2 lg:gap-8 lg:pt-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[11.5px] text-ink-dim">
            <Sparkles size={12} className="text-violet" /> Runs on real Claude — real outputs, not mocked
          </span>
          {signedIn ? (
            <>
              <h1 className="mt-4 font-display text-[40px] italic leading-[1.05] tracking-tight text-ink sm:text-[52px]">
                Welcome back.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-dim">
                Your studio is one click away — pick up where you left off, no scrolling required.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href={appHref}
                  className="flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-[14px] font-medium text-white transition hover:bg-violet/90"
                >
                  Open Flowmind <ArrowRight size={15} />
                </Link>
                <Link
                  href="/try"
                  className="rounded-xl border border-line-strong bg-white/[0.04] px-4 py-2.5 text-[14px] font-medium text-ink transition hover:bg-white/[0.1]"
                >
                  Replay the demo
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-display text-[40px] italic leading-[1.04] tracking-tight text-ink sm:text-[54px]">
                Damn, you can <span className="text-violet">see the brain.</span>
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-dim">
                Build, debug, and own multi-agent AI systems. Describe one in a sentence, watch it assemble as a
                node-and-team graph, run it on real Claude, and see exactly what every agent did.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/try"
                  className="flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-[14px] font-medium text-white transition hover:bg-violet/90"
                >
                  Try it now <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-line-strong bg-white/[0.04] px-4 py-2.5 text-[14px] font-medium text-ink transition hover:bg-white/[0.1]"
                >
                  Log in
                </Link>
              </div>
              <p className="mt-3 text-[12px] text-ink-faint">No sign-up to explore the live demo.</p>
            </>
          )}
        </motion.div>

        <Link href="/try" className="group block" aria-label="Open the live demo">
          <CanvasHero />
        </Link>
      </section>

      {/* Playable demo, high on the page (Prompt 16) */}
      <section className="mx-auto max-w-6xl px-5 pb-4 pt-2 sm:px-8">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white/[0.02] px-5 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-display text-[20px] italic text-ink">Play with a real pipeline — right now.</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-dim">
              Open a live multi-agent system on the real canvas: replay the run, read every prompt, peek the data
              between agents, and watch it bloom from simple to advanced. No login, no setup.
            </p>
          </div>
          <Link
            href="/try"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-violet/90"
          >
            <Eye size={15} /> {primaryLabel === "Open Flowmind" ? "Open the demo" : "Try it now"}
          </Link>
        </div>
      </section>

      {/* ── What it does ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
        <BandLabel kicker="What it does" title="Describe it, debug it, own it." />
      </section>
      <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <Differentiator
            icon={Eye}
            kicker="Debugging that's actually possible"
            title="See exactly what your agents did."
            body="Per-node cost and latency, right on the canvas. Click any edge to see the data that crossed it — the real 'what caused what'. Replay from any step, compare two runs, and get a plain-English explanation of a trace. The answer to 'debugging visual builders is impossible.'"
            points={["Per-node cost & latency", "Edge data peek", "Replay & run diff"]}
          />
          <Differentiator
            icon={Package}
            kicker="No lock-in"
            title="Own what you build."
            body="Export real, runnable packages — a developer bundle, a client blueprint, a founder brief, a portable runtime. Your agents don't die if a vendor changes pricing. What you design is yours to take with you."
            points={["Runnable code export", "Client & founder packages", "Portable runtime SDK"]}
          />
        </div>
      </section>

      {/* Capability tour (still "what it does") */}
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Capability icon={Bot} title="Build by describing it" body="A sentence becomes a pipeline. Refine it by talking — changes shown as a reviewable diff you approve." />
          <Capability icon={Users} title="Teams of agents" body="Nested team folders coordinate by strategy — sequential, parallel, debate, vote, router — for complex systems." />
          <Capability icon={Share2} title="Hosted Run-Apps" body="Share a working tool, not your prompts. Someone fills inputs, gets results, never sees your internals." />
          <Capability icon={Gauge} title="Command Center" body="Operate a fleet: what's live, what's failing, what's costing money — across all your pipelines at once." />
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
        <BandLabel kicker="Who it's for" title="Built for the people who ship agents." />
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <Audience icon={Workflow} title="Builders & indie hackers" body="Design sophisticated multi-agent systems and walk away with runnable code." />
          <Audience icon={Sparkles} title="Automation freelancers & agencies" body="Build and debug in front of a client, then hand off real ownership — or meter a hosted app." />
          <Audience icon={DollarSign} title="Teams" body="Workspaces, roles, shared libraries, budgets, and an audit log when governance matters." />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <h2 className="font-display text-[32px] italic leading-tight text-ink sm:text-[40px]">Damn, you can see the brain.</h2>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-dim">
          Describe → generate → run → inspect → export, all on real Claude. Start with one pipeline.
        </p>
        <Link
          href={signedIn ? appHref : "/try"}
          className="mx-auto mt-6 inline-flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-[14px] font-medium text-white transition hover:bg-violet/90"
        >
          {primaryLabel} <ArrowRight size={15} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-[12px] text-ink-faint sm:flex-row sm:px-8">
          <span className="font-display text-[16px] italic text-ink-dim">flowmind</span>
          <div className="flex items-center gap-4">
            {signedIn ? (
              <Link href={appHref} className="transition hover:text-ink">Open Flowmind</Link>
            ) : (
              <>
                <Link href="/login" className="transition hover:text-ink">Log in</Link>
                <Link href="/try" className="transition hover:text-ink">Try it now</Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── The hero visual: the real node/team canvas language ─────────────────────── */

const NODES = [
  { id: "in", label: "Input", x: 4, y: 30, color: "#22d3ee" },
  { id: "team", label: "Research Crew", x: 38, y: 8, color: "#8b5cf6", team: true },
  { id: "score", label: "Scorer", x: 40, y: 60, color: "#f5c451" },
  { id: "out", label: "Result", x: 74, y: 36, color: "#ec4899" },
];
const EDGES: [string, string][] = [
  ["in", "team"],
  ["in", "score"],
  ["team", "out"],
  ["score", "out"],
];

function CanvasHero() {
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="relative mx-auto aspect-[4/3] w-full max-w-lg rounded-2xl border border-line bg-[#0b0b13]/60 p-2"
      style={{ backgroundImage: "radial-gradient(circle, #ffffff10 1px, transparent 1px)", backgroundSize: "22px 22px" }}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {EDGES.map(([a, b], i) => {
          const s = pos[a];
          const t = pos[b];
          const sx = s.x + 14;
          const sy = s.y + 6;
          const tx = t.x;
          const ty = t.y + 6;
          const mx = (sx + tx) / 2;
          return (
            <motion.path
              key={i}
              d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={0.6}
              opacity={0.5}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.4 + i * 0.12 }}
            />
          );
        })}
      </svg>
      {NODES.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.12 }}
          className="absolute w-[28%] rounded-xl border p-2"
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            borderColor: `${n.color}66`,
            background: `linear-gradient(180deg, ${n.color}14, rgba(10,10,18,0.8))`,
            boxShadow: `0 6px 20px rgba(0,0,0,0.4)`,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: `${n.color}26`, color: n.color }}>
              {n.team ? <Users size={11} /> : <Bot size={11} />}
            </span>
            <span className="truncate text-[10px] font-medium text-ink">{n.label}</span>
          </div>
          {n.team && (
            <div className="mt-1.5 flex gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1 flex-1 rounded-full" style={{ background: `${n.color}55` }} />
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

function Differentiator({
  icon: Icon,
  kicker,
  title,
  body,
  points,
}: {
  icon: typeof Eye;
  kicker: string;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/[0.14] text-violet">
        <Icon size={20} />
      </div>
      <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-violet">{kicker}</div>
      <h3 className="mt-1 text-[20px] font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">{body}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {points.map((p) => (
          <span key={p} className="rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-ink-dim">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function BandLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="border-b border-line/60 pb-3">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-violet">{kicker}</span>
      <h2 className="mt-1 font-display text-[24px] italic leading-tight text-ink sm:text-[28px]">{title}</h2>
    </div>
  );
}

function Capability({ icon: Icon, title, body }: { icon: typeof Bot; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <Icon size={18} className="text-violet" />
      <h3 className="mt-3 text-[14px] font-medium text-ink">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{body}</p>
    </div>
  );
}

function Audience({ icon: Icon, title, body }: { icon: typeof Bot; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-white/[0.04] to-transparent p-5">
      <Icon size={18} className="text-violet" />
      <h3 className="mt-3 text-[15px] font-medium text-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{body}</p>
    </div>
  );
}
