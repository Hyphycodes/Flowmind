"use client";

import { useState } from "react";
import { Play, Sparkles, MessageSquare, Send } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { getDemoRun } from "@/lib/demo/cachedRun";
import { DEMO_COPY, DEMO_CHAT_REPLIES } from "@/lib/demo/copy";

type Msg = { role: "user" | "assistant"; text: string };

/**
 * The demo's bottom bar — a chat box that only responds to preset chips with pre-baked answers
 * (no AI endpoint is ever called), plus the replay control and the simple↔advanced reveal.
 */
export function DemoBar({ onReplayCount }: { onReplayCount?: (n: number) => void }) {
  const demoLevel = usePipelineStore((s) => s.demoLevel);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const playDemoReplay = usePipelineStore((s) => s.playDemoReplay);
  const setDemoLevel = usePipelineStore((s) => s.setDemoLevel);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [replays, setReplays] = useState(0);

  const running = runStatus === "running";

  function say(user: string, assistant: string) {
    setOpen(true);
    setMessages((m) => [...m, { role: "user", text: user }, { role: "assistant", text: assistant }]);
  }

  function replay() {
    playDemoReplay();
    const n = replays + 1;
    setReplays(n);
    onReplayCount?.(n);
  }

  function toAdvanced() {
    setDemoLevel("deep");
    say(DEMO_COPY.chips.advanced, DEMO_CHAT_REPLIES.advanced);
  }
  function toSimple() {
    setDemoLevel("simple");
    say(DEMO_COPY.chips.simple, DEMO_CHAT_REPLIES.simple);
  }
  function explain() {
    const expl = getDemoRun(demoLevel).explanation.summary;
    say(DEMO_COPY.chips.explain, expl);
  }
  function addScorer() {
    say(DEMO_COPY.chips.scorer, DEMO_CHAT_REPLIES.scorer);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-4">
      {open && messages.length > 0 && (
        <div className="pointer-events-auto max-h-[40vh] w-full max-w-2xl space-y-2 overflow-y-auto rounded-2xl border border-line bg-black/70 p-3 backdrop-blur">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={
                  m.role === "user"
                    ? "inline-block rounded-2xl bg-violet/90 px-3 py-1.5 text-[13px] text-white"
                    : "inline-block rounded-2xl border border-line bg-white/[0.04] px-3 py-1.5 text-[13px] text-ink-dim"
                }
              >
                {m.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-black/60 p-2 backdrop-blur">
        <button
          onClick={replay}
          disabled={running}
          className="flex items-center gap-1.5 rounded-xl bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
        >
          <Play size={13} /> {running ? "Playing…" : "Replay run"}
        </button>
        {demoLevel === "simple" ? (
          <button
            onClick={toAdvanced}
            className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white/[0.04] px-3 py-1.5 text-[13px] text-ink transition hover:bg-white/[0.1]"
          >
            <Sparkles size={13} /> {DEMO_COPY.chips.advanced}
          </button>
        ) : (
          <button
            onClick={toSimple}
            className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white/[0.04] px-3 py-1.5 text-[13px] text-ink transition hover:bg-white/[0.1]"
          >
            {DEMO_COPY.chips.simple}
          </button>
        )}
        <button onClick={explain} className="rounded-xl border border-line bg-white/[0.03] px-3 py-1.5 text-[13px] text-ink-dim transition hover:bg-white/[0.08] hover:text-ink">
          {DEMO_COPY.chips.explain}
        </button>
        <button onClick={addScorer} className="rounded-xl border border-line bg-white/[0.03] px-3 py-1.5 text-[13px] text-ink-dim transition hover:bg-white/[0.08] hover:text-ink">
          {DEMO_COPY.chips.scorer}
        </button>

        <div className="ml-auto flex items-center gap-1.5 rounded-xl border border-line bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-faint">
          <MessageSquare size={13} />
          <span className="hidden sm:inline">Pick a prompt above</span>
          <Send size={13} className="opacity-40" />
        </div>
      </div>
    </div>
  );
}
