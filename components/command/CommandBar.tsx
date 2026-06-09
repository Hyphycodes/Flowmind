"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";

const CHIPS = [
  "Real estate deal analyzer",
  "Content repurposer",
  "Inbox assistant",
  "Market research engine",
];

export function CommandBar() {
  const generate = usePipelineStore((s) => s.generate);
  const generating = usePipelineStore((s) => s.generating);
  const notice = usePipelineStore((s) => s.notice);
  const setNotice = usePipelineStore((s) => s.setNotice);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const submit = (value?: string) => {
    const v = (value ?? text).trim();
    if (!v || generating) return;
    setText("");
    void generate(v);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 pb-6">
      {notice ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-ink-dim glass-strong fm-fade-up">
          <Sparkles size={12} className="text-violet" />
          {notice}
          <button onClick={() => setNotice(null)} className="text-ink-faint hover:text-ink">
            <X size={12} />
          </button>
        </div>
      ) : null}

      <div className="pointer-events-auto w-full max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-2xl px-3 py-2 glass-strong shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
          <Sparkles size={17} className="ml-1 shrink-0 text-violet" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the AI system you want to build…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={generating || !text.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet text-white transition hover:bg-violet/90 disabled:opacity-40"
            aria-label="Generate pipeline"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => submit(c)}
              disabled={generating}
              className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-ink-dim transition hover:bg-white/[0.08] hover:text-ink disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
