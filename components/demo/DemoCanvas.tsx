"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Package } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { PipelineCanvas } from "@/components/canvas/PipelineCanvas";
import { NodePopover } from "@/components/canvas/NodePopover";
import { NodeInspector } from "@/components/panels/NodeInspector";
import { OutputPanel } from "@/components/panels/OutputPanel";
import { ExportDialog } from "@/components/export/ExportDialog";
import { DemoBar } from "@/components/demo/DemoBar";
import { DemoNudge } from "@/components/demo/DemoNudge";
import { DEMO_COPY } from "@/lib/demo/copy";

/**
 * The public `/try` canvas (Prompt 13–14). Renders the REAL Flowmind canvas + inspector + output
 * panel read-only, driven by the cached run (Prompt 12) via `demoMode`. No login, no AI calls, no
 * persistence. Conversion gates (Prompt 14) sit only on edit/save/export — explore freely.
 */
export function DemoCanvas() {
  const demoMode = usePipelineStore((s) => s.demoMode);
  const demoLevel = usePipelineStore((s) => s.demoLevel);
  const enterDemoMode = usePipelineStore((s) => s.enterDemoMode);
  const openExport = usePipelineStore((s) => s.openExport);

  // Nudge fires once per session, after real exploration (2nd replay OR opening advanced).
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const nudgeDone = useRef(false);

  function maybeNudge() {
    if (nudgeDone.current) return;
    nudgeDone.current = true;
    setNudgeVisible(true);
  }

  useEffect(() => {
    enterDemoMode("simple");
    // Leaving the demo must clear demoMode so it can't bleed into a signed-in workspace later.
    return () => usePipelineStore.setState({ demoMode: false });
  }, [enterDemoMode]);

  // Trigger the nudge when the user opens the advanced version.
  useEffect(() => {
    if (demoLevel === "deep") maybeNudge();
  }, [demoLevel]);

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
        <div className="ml-auto flex items-center gap-2">
          {/* Save affordance — visible, gated softly (Prompt 14). */}
          <Link
            href={DEMO_COPY.signupHref}
            title={DEMO_COPY.saveGate}
            className="rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-ink-dim transition hover:text-ink"
          >
            Save
          </Link>
          {/* Export opens the full drawer; only the download button is gated. */}
          <button
            onClick={openExport}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-ink-dim transition hover:text-ink"
          >
            <Package size={13} /> Export
          </button>
          <Link
            href={DEMO_COPY.signupHref}
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
          >
            <Sparkles size={13} /> {DEMO_COPY.signupCta}
          </Link>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {demoMode ? <PipelineCanvas /> : null}
          <NodePopover />
          <NodeInspector />
          <ExportDialog />
          <DemoBar onReplayCount={(n) => { if (n >= 2) maybeNudge(); }} />
          {nudgeVisible && <DemoNudge onDismiss={() => setNudgeVisible(false)} />}
        </div>
        <OutputPanel />
      </div>
    </div>
  );
}
