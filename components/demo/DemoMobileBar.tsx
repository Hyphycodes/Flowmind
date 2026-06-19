"use client";

import { Play, Sparkles } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { DEMO_COPY } from "@/lib/demo/copy";

/** Slim bottom controls for the mobile demo viewer — the two interactions that
 *  actually change the graph (replay the run, simple↔advanced). The chat-only
 *  chips (explain / add scorer) are desktop-only; here the canvas is the story. */
export function DemoMobileBar({ onAdvanced }: { onAdvanced?: () => void }) {
  const demoLevel = usePipelineStore((s) => s.demoLevel);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const playDemoReplay = usePipelineStore((s) => s.playDemoReplay);
  const setDemoLevel = usePipelineStore((s) => s.setDemoLevel);
  const running = runStatus === "running";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-line bg-black/70 p-2 backdrop-blur">
        <button
          type="button"
          onClick={() => playDemoReplay()}
          disabled={running}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet px-3 py-2.5 text-[13px] font-medium text-white transition active:bg-violet/80 disabled:opacity-50"
        >
          <Play size={14} /> {running ? "Playing…" : "Replay run"}
        </button>
        {demoLevel === "simple" ? (
          <button
            type="button"
            onClick={() => {
              setDemoLevel("deep");
              onAdvanced?.();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-white/[0.05] px-3 py-2.5 text-[13px] text-ink transition active:bg-white/[0.12]"
          >
            <Sparkles size={14} /> {DEMO_COPY.chips.advanced}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDemoLevel("simple")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-white/[0.05] px-3 py-2.5 text-[13px] text-ink transition active:bg-white/[0.12]"
          >
            {DEMO_COPY.chips.simple}
          </button>
        )}
      </div>
    </div>
  );
}
