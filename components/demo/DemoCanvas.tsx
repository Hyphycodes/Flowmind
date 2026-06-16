"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { PipelineCanvas } from "@/components/canvas/PipelineCanvas";
import { NodePopover } from "@/components/canvas/NodePopover";
import { NodeInspector } from "@/components/panels/NodeInspector";
import { OutputPanel } from "@/components/panels/OutputPanel";
import { DemoBar } from "@/components/demo/DemoBar";
import { DEMO_COPY } from "@/lib/demo/copy";

/**
 * The public `/try` canvas (Prompt 13). Renders the REAL Flowmind canvas + inspector + output panel
 * read-only, driven entirely by the cached run (Prompt 12) via the store's `demoMode`. No login, no
 * AI calls, no persistence — explore, replay, peek edges, read full prompts, and bloom simple→deep.
 */
export function DemoCanvas() {
  const demoMode = usePipelineStore((s) => s.demoMode);
  const enterDemoMode = usePipelineStore((s) => s.enterDemoMode);

  useEffect(() => {
    enterDemoMode("simple");
    // Leaving the demo must clear demoMode so it can't bleed into a signed-in workspace later.
    return () => usePipelineStore.setState({ demoMode: false });
  }, [enterDemoMode]);

  return (
    <div className="flex h-[100dvh] flex-col bg-bg">
      {/* Demo top strip (no Sidebar / network TopBar — the canvas is the hero) */}
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <Link href="/" className="font-display text-[15px] italic text-ink">
          Flowmind
        </Link>
        <span className="rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink-faint">
          {DEMO_COPY.badge}
        </span>
        <Link
          href={DEMO_COPY.signupHref}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
        >
          <Sparkles size={13} /> {DEMO_COPY.signupCta}
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {demoMode ? <PipelineCanvas /> : null}
          <NodePopover />
          <NodeInspector />
          <DemoBar />
        </div>
        <OutputPanel />
      </div>
    </div>
  );
}
