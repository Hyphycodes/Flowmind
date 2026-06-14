"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CloudOff,
  Loader2,
  PanelRight,
  Play,
  Share2,
  TriangleAlert,
} from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { CreditEstimate } from "@/components/billing/CreditEstimate";
import { cn } from "@/lib/ui/cn";

export function TopBar() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const saveStatus = usePipelineStore((s) => s.saveStatus);
  const renamePipeline = usePipelineStore((s) => s.renamePipeline);
  const togglePanel = usePipelineStore((s) => s.togglePanel);
  const executionMode = usePipelineStore((s) => s.executionMode);
  const setExecutionMode = usePipelineStore((s) => s.setExecutionMode);
  const openExport = usePipelineStore((s) => s.openExport);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const running = runStatus === "running";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r" && !typing) {
        e.preventDefault();
        void runPipeline();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runPipeline]);

  const startEdit = () => {
    if (!pipeline) return;
    setDraft(pipeline.name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const commit = () => {
    if (draft.trim()) renamePipeline(draft.trim());
    setEditing(false);
  };

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-line bg-[#08080e]/70 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-ink-faint">Pipelines</span>
        <span className="text-ink-faint">/</span>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-64 rounded-md border border-line-strong bg-white/5 px-2 py-0.5 text-sm text-ink outline-none"
          />
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 truncate font-medium text-ink hover:text-white"
            title="Rename pipeline"
          >
            <span className="truncate">{pipeline?.name ?? "Untitled Pipeline"}</span>
            <ChevronDown size={14} className="text-ink-faint" />
          </button>
        )}
        <SaveBadge status={saveStatus} />
      </div>

      <div className="flex items-center gap-2">
        <select
          value={executionMode}
          onChange={(e) => setExecutionMode(e.target.value as typeof executionMode)}
          title="Execution mode — Simulate uses datasets, Live uses real models/tools, Hybrid mixes both"
          className="rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 text-[12px] text-ink-dim outline-none transition hover:text-ink"
        >
          <option value="simulate">Simulate</option>
          <option value="hybrid">Hybrid</option>
          <option value="live">Live</option>
        </select>
        {pipeline && !running && <CreditEstimate request={{ kind: "run", pipeline }} compact />}
        <button
          type="button"
          onClick={() => void runPipeline()}
          disabled={running || !pipeline}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-line-strong bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50",
            running && "text-violet",
          )}
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} className="fill-current" />}
          {running ? "Running" : "Run"}
          <kbd className="ml-0.5 rounded bg-white/5 px-1 text-[10px] text-ink-faint">⌘R</kbd>
        </button>

        <button
          type="button"
          onClick={() => togglePanel()}
          title="Toggle output panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition hover:bg-white/5 hover:text-ink"
        >
          <PanelRight size={16} />
        </button>

        <button
          type="button"
          onClick={openExport}
          disabled={!pipeline}
          title="Export — developer package, client blueprint, founder brief, runtime, API"
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5 text-sm text-ink-dim transition hover:bg-white/5 hover:text-ink disabled:opacity-50"
        >
          <Share2 size={15} /> Export
        </button>

        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-xs font-semibold text-white">
          F
        </div>
      </div>
    </header>
  );
}

function SaveBadge({ status }: { status: string }) {
  if (status === "idle") return null;
  const map: Record<string, { icon: React.ReactNode; text: string; cls: string }> = {
    saving: { icon: <Loader2 size={12} className="animate-spin" />, text: "Saving…", cls: "text-ink-faint" },
    saved: { icon: <Check size={12} />, text: "Autosaved", cls: "text-ink-faint" },
    local: { icon: <CloudOff size={12} />, text: "Local only", cls: "text-ink-faint" },
    error: { icon: <TriangleAlert size={12} />, text: "Save failed", cls: "text-red" },
  };
  const m = map[status] ?? map.saved;
  return (
    <span className={cn("ml-3 flex items-center gap-1.5 text-xs", m.cls)}>
      <span className={status === "saved" ? "text-green" : ""}>{m.icon}</span>
      {m.text}
    </span>
  );
}
