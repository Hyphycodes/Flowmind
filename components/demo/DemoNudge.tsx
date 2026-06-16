"use client";

import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { DEMO_COPY } from "@/lib/demo/copy";

/**
 * The single soft nudge (Prompt 14). Slides in from the bottom after real exploration (second
 * replay OR opening the advanced version). Dismissible, never blocks interaction, and the parent
 * ensures it does not re-fire once dismissed in the same session.
 */
export function DemoNudge({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fm-fade-up pointer-events-auto fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-line-strong bg-black/80 px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur">
      <Sparkles size={15} className="text-violet" />
      <span className="text-[13px] text-ink">{DEMO_COPY.nudge}</span>
      <Link
        href={DEMO_COPY.signupHref}
        className="rounded-lg bg-violet px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90"
      >
        {DEMO_COPY.nudgeCta}
      </Link>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-faint transition hover:text-ink">
        <X size={15} />
      </button>
    </div>
  );
}
