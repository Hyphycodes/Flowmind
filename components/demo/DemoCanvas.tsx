"use client";

import { useEffect, useRef, useState } from "react";
import { usePipelineStore } from "@/store/pipelineStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { PipelineCanvas } from "@/components/canvas/PipelineCanvas";
import { NodePopover } from "@/components/canvas/NodePopover";
import { NodeInspector } from "@/components/panels/NodeInspector";
import { OutputPanel } from "@/components/panels/OutputPanel";
import { ExportDialog } from "@/components/export/ExportDialog";
import { DemoBar } from "@/components/demo/DemoBar";
import { DemoTopBar } from "@/components/demo/DemoTopBar";
import { DemoNudge } from "@/components/demo/DemoNudge";

/**
 * The public `/try` canvas (Prompt 13–14). Renders the REAL Flowmind canvas + inspector + output
 * panel read-only, driven by the cached run (Prompt 12) via `demoMode`. No login, no AI calls, no
 * persistence. Conversion gates (Prompt 14) sit only on edit/save/export — explore freely.
 */
export function DemoCanvas() {
  const demoMode = usePipelineStore((s) => s.demoMode);
  const demoLevel = usePipelineStore((s) => s.demoLevel);
  const enterDemoMode = usePipelineStore((s) => s.enterDemoMode);

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
    // Mirror the signed-in editor shell so the demo looks like the real app before login:
    // left Sidebar + editor-style TopBar + canvas + the shared Preview/Input/Output panel.
    <div className="surface-locked flex bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoTopBar />
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
    </div>
  );
}
