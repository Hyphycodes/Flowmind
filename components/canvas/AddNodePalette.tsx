"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { NODE_TYPES } from "@/lib/pipeline/schema";
import { ACCENT_HEX } from "@/lib/ui/colors";
import { KIND_LABEL, KIND_DESCRIPTION, KIND_ACCENT } from "@/lib/ui/nodeKinds";
import { cn } from "@/lib/ui/cn";

/** The "+ add node" palette: built-in node kinds + reusable assets From Library. Top-level only. */
export function AddNodePalette() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const teamPath = usePipelineStore((s) => s.teamPath);
  const libraryAssets = usePipelineStore((s) => s.libraryAssets);
  const hydrateLibrary = usePipelineStore((s) => s.hydrateLibrary);
  const insertNodeKind = usePipelineStore((s) => s.insertNodeKind);
  const insertLibraryNode = usePipelineStore((s) => s.insertLibraryNode);
  const applyPromptToSelected = usePipelineStore((s) => s.applyPromptToSelected);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void hydrateLibrary();
  }, [hydrateLibrary]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!pipeline || teamPath.length > 0) return null;

  const nodeAssets = libraryAssets.filter((a) => a.kind === "node");
  const promptAssets = libraryAssets.filter((a) => a.kind === "prompt");
  const hasAssets = nodeAssets.length > 0 || promptAssets.length > 0;

  return (
    <div ref={ref} className="absolute left-4 top-4 z-20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink glass-strong transition hover:brightness-110"
      >
        <Plus size={14} className="text-violet" /> Add node
      </button>

      {open && (
        <div className="mt-2 max-h-[60vh] w-[264px] overflow-y-auto rounded-2xl p-3 glass-strong shadow-[0_16px_48px_rgba(0,0,0,0.55)] fm-fade-up">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">Built-in</p>
          <div className="space-y-1">
            {NODE_TYPES.map((k) => (
              <button
                key={k}
                onClick={() => {
                  insertNodeKind(k);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-left transition hover:border-line-strong active:bg-white/[0.05]"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT_HEX[KIND_ACCENT[k]] }} />
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-ink">{KIND_LABEL[k]}</span>
                  <span className="block text-[10.5px] leading-snug text-ink-faint">{KIND_DESCRIPTION[k]}</span>
                </span>
              </button>
            ))}
          </div>

          {hasAssets && (
            <>
              <p className="mb-1.5 mt-3 text-[10px] font-medium uppercase tracking-wide text-ink-faint">From Library</p>
              <div className="space-y-1">
                {nodeAssets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      insertLibraryNode(a.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-left text-[12px] text-ink transition hover:border-line-strong"
                  >
                    <Plus size={11} className="shrink-0 text-violet" />
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
                {promptAssets.map((a) => (
                  <button
                    key={a.id}
                    disabled={!selectedNodeId}
                    title={selectedNodeId ? "Apply this prompt to the selected node" : "Select a node first"}
                    onClick={() => {
                      applyPromptToSelected(String(a.payload ?? ""), a.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-left text-[12px] transition",
                      selectedNodeId ? "text-ink-dim hover:border-line-strong hover:text-ink" : "cursor-not-allowed text-ink-faint opacity-60",
                    )}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-violet">↳</span>
                    <span className="truncate">{a.name}</span>
                    <span className="ml-auto shrink-0 text-[9.5px] text-ink-faint">prompt</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!hasAssets && (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Save nodes &amp; prompts from a node&apos;s popover to reuse them here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
