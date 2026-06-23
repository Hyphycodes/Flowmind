"use client";

import { useState } from "react";
import { Play, Sparkles, MessageSquare, Send, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { getDemoRun } from "@/lib/demo/cachedRun";
import { DEMO_COPY, DEMO_CHAT_REPLIES } from "@/lib/demo/copy";

type Msg = { role: "user" | "assistant"; text: string };

/**
 * The demo's bottom-center bar — a chat box with preset chips (pre-baked answers, no AI endpoint is
 * ever called) plus a REAL text input. Typing + sending appends the user's message and a gated reply
 * and fires the sign-up nudge; it never calls a network. Also holds the replay control and the
 * simple↔advanced reveal. Transcript docks directly above and is closeable.
 */
export function DemoBar({
  onReplayCount,
  onGatedSubmit,
}: {
  onReplayCount?: (n: number) => void;
  onGatedSubmit?: () => void;
}) {
  const demoLevel = usePipelineStore((s) => s.demoLevel);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const playDemoReplay = usePipelineStore((s) => s.playDemoReplay);
  const setDemoLevel = usePipelineStore((s) => s.setDemoLevel);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [replays, setReplays] = useState(0);
  const [draft, setDraft] = useState("");

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

  // Real, gated submit — no network call, ever. Appends the message + the gated reply,
  // opens the transcript, and fires the soft sign-up nudge.
  function submitDraft() {
    const text = draft.trim();
    if (!text) return;
    say(text, DEMO_COPY.gatedReply);
    setDraft("");
    onGatedSubmit?.();
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-20">
      {open && messages.length > 0 && (
        <div className="pointer-events-auto flex w-full max-w-2xl flex-col rounded-2xl border border-line bg-black/70 backdrop-blur">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[12px] font-medium text-ink-dim">{DEMO_COPY.chatTitle}</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-ink-faint transition hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
          <div className="max-h-[38vh] space-y-2 overflow-y-auto p-3">
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
        </div>
      )}

      <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-line bg-black/60 p-2 backdrop-blur">
        {/* chip row — wraps on small widths, never overflows the canvas */}
        <div className="flex flex-wrap items-center gap-1.5">
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
        </div>

        {/* real input row */}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-1.5">
          <MessageSquare size={14} className="shrink-0 text-ink-faint" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitDraft();
              }
            }}
            placeholder={DEMO_COPY.inputPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={submitDraft}
            disabled={!draft.trim()}
            aria-label="Send"
            className="shrink-0 text-ink-dim transition hover:text-ink disabled:opacity-30"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
