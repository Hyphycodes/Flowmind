"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Atmosphere } from "./Atmosphere";
import { HeroGraph } from "./HeroGraph";

/** Section 1 — Hero. Atmosphere loop behind; kinetic display headline; the
 *  pipeline assembling itself beneath; one primary CTA. */
export function Hero({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <section className="relative isolate overflow-hidden px-5 pb-16 pt-24 sm:px-8 sm:pt-28 lg:pb-24 lg:pt-32">
      <Atmosphere />

      <div className="mx-auto max-w-3xl text-center">
        <motion.div {...rise(0)}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[11.5px] text-ink-dim backdrop-blur-sm">
            <Sparkles size={12} className="text-violet" /> Runs on real models — real outputs, not mocked
          </span>
        </motion.div>

        <motion.h1
          {...rise(0.08)}
          className="mt-6 font-display text-[44px] italic leading-[1.02] tracking-tight text-ink sm:text-[68px] lg:text-[80px]"
        >
          You built the AI.
          <br />
          Now <span className="text-violet">see inside it.</span>
        </motion.h1>

        <motion.p {...rise(0.16)} className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-ink-dim sm:text-[16.5px]">
          Describe a multi-agent system in a sentence. Watch it assemble as a node-and-team graph, run it for
          real, and see exactly what every agent did.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href={ctaHref}
            className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet px-6 py-3 text-[14.5px] font-medium text-white shadow-[0_0_0_0_rgba(139,92,246,0)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet/90 hover:shadow-[0_12px_36px_-8px_rgba(139,92,246,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:w-auto"
          >
            {ctaLabel}
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#import"
            className="rounded-xl px-4 py-3 text-[14px] text-ink-dim transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
          >
            See how it works
          </a>
        </motion.div>
      </div>

      {/* The product, assembling itself — real node/edge language. */}
      <motion.div {...rise(0.34)} className="mx-auto mt-14 max-w-5xl sm:mt-16">
        <HeroGraph />
      </motion.div>
    </section>
  );
}
