"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useInViewOnce } from "./hooks";

/** Section 4 — positioning poster. Large type, lots of air. The gut-check line. */
export function PositioningPoster() {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  const reduce = useReducedMotion();
  const lines = [
    { a: "Dify", b: " is for shipping.", dim: true },
    { a: "n8n", b: " is for automating.", dim: true },
    { a: "Flowmind", b: " is for understanding.", dim: false },
  ];
  return (
    <section className="px-5 py-28 sm:px-8 lg:py-40">
      <div ref={ref} className="mx-auto max-w-4xl">
        {lines.map((l, i) => (
          <motion.p
            key={l.a}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={seen ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, delay: reduce ? 0 : i * 0.14, ease: [0.22, 1, 0.36, 1] }}
            className={`text-[32px] font-medium leading-[1.12] tracking-tight sm:text-[52px] lg:text-[60px] ${
              l.dim ? "text-ink-faint" : "text-ink"
            }`}
          >
            {l.dim ? (
              <>
                {l.a}
                {l.b}
              </>
            ) : (
              <>
                {l.a}
                <span> is for </span>
                <span className="text-violet">understanding.</span>
              </>
            )}
          </motion.p>
        ))}
      </div>
    </section>
  );
}

/** Section 5 — one quiet call to action. */
export function FinalCTA({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  const reduce = useReducedMotion();
  return (
    <section className="px-5 pb-32 pt-8 text-center sm:px-8">
      <motion.div
        ref={ref}
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={seen ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-xl"
      >
        <h2 className="font-display text-[34px] italic leading-tight text-ink sm:text-[46px]">See inside your system.</h2>
        <p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed text-ink-dim">
          Describe, run, inspect, and export — all on real models. Start with one pipeline.
        </p>
        <Link
          href={ctaHref}
          className="group mt-8 inline-flex items-center gap-1.5 rounded-xl bg-violet px-6 py-3 text-[14.5px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet/90 hover:shadow-[0_12px_36px_-8px_rgba(139,92,246,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {ctaLabel}
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </section>
  );
}
