"use client";

import Link from "next/link";
import { Loader2, PanelRight, Play, Share2, Sparkles, UserPlus } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { DEMO_COPY } from "@/lib/demo/copy";

/**
 * The public `/try` top bar. Visually mirrors the signed-in editor TopBar (same height, breadcrumb,
 * and button vocabulary) so the demo feels like the real app — but every write action is a soft
 * conversion gate (→ /signup), and "Run" replays the cached run instead of calling the engine.
 */
export function DemoTopBar() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const playDemoReplay = usePipelineStore((s) => s.playDemoReplay);
  const togglePanel = usePipelineStore((s) => s.togglePanel);
  const openExport = usePipelineStore((s) => s.openExport);
  const running = runStatus === "running";

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-line bg-[#08080e]/70 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-ink-faint">Pipelines</span>
        <span className="text-ink-faint">/</span>
        <span className="max-w-[280px] truncate font-medium text-ink">{pipeline?.name ?? "Live Demo"}</span>
        <span className="ml-3 rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink-faint">
          {DEMO_COPY.badge}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => playDemoReplay()}
          disabled={running}
          className="flex items-center gap-2 rounded-lg border border-line-strong bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} className="fill-current" />}
          {running ? "Running" : "Run"}
        </button>

        <button
          type="button"
          onClick={() => togglePanel()}
          title="Toggle output panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition hover:bg-white/5 hover:text-ink"
        >
          <PanelRight size={16} />
        </button>

        <Link
          href={DEMO_COPY.signupHref}
          title="Sign up free to share a hosted app"
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5 text-sm text-ink-dim transition hover:bg-white/5 hover:text-ink"
        >
          <UserPlus size={15} /> Share
        </Link>

        <button
          type="button"
          onClick={openExport}
          title="Export — preview the developer package, client blueprint, founder brief, runtime, API"
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5 text-sm text-ink-dim transition hover:bg-white/5 hover:text-ink"
        >
          <Share2 size={15} /> Export
        </button>

        <Link
          href={DEMO_COPY.signupHref}
          className="ml-1 flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-violet/90"
        >
          <Sparkles size={14} /> {DEMO_COPY.signupCta}
        </Link>
      </div>
    </header>
  );
}
