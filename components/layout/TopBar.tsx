"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CloudOff,
  Loader2,
  PanelRight,
  Play,
  Plus,
  Search,
  Share2,
  TriangleAlert,
  UserPlus,
  Zap,
} from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { CreditEstimate } from "@/components/billing/CreditEstimate";
import { hasSupabase } from "@/lib/supabase/client";
import { listPipelines, type PipelineSummary } from "@/lib/supabase/queries";
import { timeAgo } from "@/lib/ui/format";
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
  const openShare = usePipelineStore((s) => s.openShare);
  const openTriggers = usePipelineStore((s) => s.openTriggers);

  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const running = runStatus === "running";

  // Pipeline switcher dropdown
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switchList, setSwitchList] = useState<PipelineSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const switcherRef = useRef<HTMLDivElement>(null);

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

  // Close the switcher on outside-click or Escape.
  useEffect(() => {
    if (!switcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) setSwitcherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [switcherOpen]);

  const filtered = useMemo(
    () => (switchList ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [switchList, query],
  );

  const goto = (href: string) => {
    setSwitcherOpen(false);
    // The editor reads ?open / ?new only on mount, so switching pipelines from inside
    // the editor needs a full navigation. /pipelines is a separate route → client router.
    if (href.startsWith("/pipelines")) router.push(href);
    else window.location.assign(href);
  };

  // Toggle the switcher; fetch the list the first time it opens (in a handler, not an effect).
  const toggleSwitcher = () => {
    const next = !switcherOpen;
    setSwitcherOpen(next);
    if (next && switchList === null) {
      if (hasSupabase()) listPipelines().then(setSwitchList);
      else setSwitchList([]);
    }
  };

  const startEdit = () => {
    if (!pipeline) return;
    setSwitcherOpen(false);
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
          <div ref={switcherRef} className="relative flex items-center gap-0.5">
            <button
              onClick={startEdit}
              className="max-w-[280px] truncate font-medium text-ink hover:text-white"
              title="Rename pipeline"
            >
              <span className="truncate">{pipeline?.name ?? "Untitled Pipeline"}</span>
            </button>
            <button
              type="button"
              onClick={toggleSwitcher}
              aria-label="Switch pipeline"
              aria-expanded={switcherOpen}
              title="Switch pipeline"
              className="rounded p-0.5 text-ink-faint transition hover:bg-white/5 hover:text-ink"
            >
              <ChevronDown size={14} />
            </button>

            {switcherOpen && (
              <div className="absolute left-0 top-8 z-40 w-72 rounded-xl border border-line bg-[#0c0c14] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-black/30 px-2.5 py-1.5">
                  <Search size={13} className="shrink-0 text-ink-faint" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search pipelines…"
                    className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-faint"
                  />
                </div>

                <div className="mt-1 max-h-72 overflow-y-auto">
                  {switchList === null ? (
                    <div className="flex items-center justify-center py-5">
                      <Loader2 size={15} className="animate-spin text-ink-faint" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="px-2 py-4 text-center text-[11.5px] text-ink-faint">
                      {switchList.length === 0 ? "No pipelines yet." : "No matches."}
                    </p>
                  ) : (
                    filtered.slice(0, 8).map((p) => {
                      const current = p.id === pipeline?.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={current}
                          onClick={() => goto(`/editor?open=${p.id}`)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition",
                            current ? "cursor-default text-ink" : "text-ink-dim hover:bg-white/[0.06] hover:text-ink",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px]">{p.name}</div>
                            <div className="text-[10.5px] text-ink-faint">{timeAgo(p.updatedAt)}</div>
                          </div>
                          {current && <Check size={13} className="shrink-0 text-violet" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-1 space-y-0.5 border-t border-line pt-1">
                  <button
                    type="button"
                    onClick={() => goto("/editor?new=1")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink"
                  >
                    <Plus size={13} /> New pipeline
                  </button>
                  <button
                    type="button"
                    onClick={() => goto("/pipelines")}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-dim transition hover:bg-white/[0.06] hover:text-ink"
                  >
                    <ArrowRight size={13} /> All pipelines
                  </button>
                </div>
              </div>
            )}
          </div>
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
          onClick={openTriggers}
          disabled={!pipeline}
          title="Automate — schedule, webhook, or pipeline-to-pipeline triggers"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition hover:bg-white/5 hover:text-ink disabled:opacity-50"
        >
          <Zap size={16} />
        </button>

        <button
          type="button"
          onClick={openShare}
          disabled={!pipeline}
          title="Share — View, Run (hosted mini-app), or Edit access"
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5 text-sm text-ink-dim transition hover:bg-white/5 hover:text-ink disabled:opacity-50"
        >
          <UserPlus size={15} /> Share
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
