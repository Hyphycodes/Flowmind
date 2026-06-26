"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Clock, DollarSign, FileText, Layers, ListChecks, Loader2, Play, Sparkles, Table2, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import type { OutputTable, UIBinding } from "@/lib/pipeline/schema";
import { totalCost, totalDuration } from "@/lib/trace/metrics";
import { formatDuration, formatUsd } from "@/lib/ui/format";
import { ACCENT_HEX, isAccent } from "@/lib/ui/colors";
import { cn } from "@/lib/ui/cn";
import { UIPreview } from "./UIPreview";
import { TableView } from "./TableView";

/** The Results Theater (Prompt 02): a big, focused payoff view of a run's outputs. Opened from
 *  the right rail's "View results". Reuses the existing rendered-view (UIPreview) and table
 *  (TableView) renderers, just with room to breathe — the right rail stays the live index. */
export function ResultsTheater() {
  const open = usePipelineStore((s) => s.resultsOpen);
  const close = usePipelineStore((s) => s.closeResults);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return <Theater onClose={close} />;
}

function Theater({ onClose }: { onClose: () => void }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const tables = usePipelineStore((s) => s.tables);
  const finalOutput = usePipelineStore((s) => s.finalOutput);
  const steps = usePipelineStore((s) => s.steps);
  const activeRunTrace = usePipelineStore((s) => s.activeRunTrace);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const runError = usePipelineStore((s) => s.runError);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const setPanelTab = usePipelineStore((s) => s.setPanelTab);

  const bindings = pipeline?.uiBindings ?? [];
  const populated = tables.filter((t) => t.rows.length > 0);
  const ran = Boolean(finalOutput) || populated.length > 0;
  const running = runStatus === "running";

  const totalRows = tables.reduce((n, t) => n + t.rows.length, 0);
  const stepsRun = steps.filter((s) => s.status !== "idle").length;
  const dur = totalDuration(steps) ?? 0;
  const cost = totalCost(steps, activeRunTrace?.costUsd) ?? 0;

  const jump = (nodeId?: string) => {
    if (!nodeId) return;
    selectNode(nodeId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/60 p-[3vh] backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fade-up relative h-fit min-h-[60vh] w-full max-w-5xl rounded-3xl border border-line-strong bg-[#0b0b13]/95 shadow-[0_32px_96px_rgba(0,0,0,0.7)]"
      >
        {/* Header — the confident "here's what you made" moment */}
        <div className="sticky top-0 z-10 flex items-start gap-4 rounded-t-3xl border-b border-line bg-[#0b0b13]/95 px-7 py-6 backdrop-blur-xl">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet/15 text-violet">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[26px] italic leading-tight text-ink">
              {ran ? "Here's what your pipeline produced" : "Your results will appear here"}
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-ink-dim">{pipeline?.name ?? "Pipeline"}</p>
            {ran && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-dim">
                <Stat icon={Layers} label={`${populated.length} output ${populated.length === 1 ? "table" : "tables"}`} />
                <Stat icon={Table2} label={`${totalRows} ${totalRows === 1 ? "row" : "rows"}`} />
                <Stat icon={ListChecks} label={`${stepsRun} ${stepsRun === 1 ? "step" : "steps"}`} />
                {dur > 0 && <Stat icon={Clock} label={formatDuration(dur)} />}
                {cost > 0 && <Stat icon={DollarSign} label={formatUsd(cost)} />}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close results" className="shrink-0 rounded-lg p-1 text-ink-faint transition hover:bg-white/5 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-8 px-7 py-7">
          {!ran ? (
            <EmptyState running={running} onRun={() => void runPipeline()} />
          ) : (
            <>
              {runError && (
                <div className="rounded-xl border border-red/30 bg-red/[0.06] px-4 py-3 text-[12.5px] text-ink">
                  <span className="font-medium text-red">Partial run.</span> {runError} — what completed is shown below.
                </div>
              )}

              {/* The deliverable document — the executive output, rendered to read */}
              {finalOutput && (finalOutput.title || finalOutput.summary || finalOutput.highlights.length > 0) && (
                <section className="rounded-2xl border border-line bg-gradient-to-b from-white/[0.05] to-transparent p-6">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    <FileText size={12} /> Final output
                  </div>
                  {finalOutput.title && <h2 className="text-[22px] font-semibold leading-snug text-ink">{finalOutput.title}</h2>}
                  {finalOutput.summary && (
                    <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-dim">{finalOutput.summary}</p>
                  )}
                  {finalOutput.highlights.length > 0 && (
                    <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-line/60 pt-4 sm:grid-cols-2">
                      {finalOutput.highlights.map((h, i) => {
                        const color = h.accent && isAccent(h.accent) ? ACCENT_HEX[h.accent] : "#8b8b9e";
                        return (
                          <div key={i} className="flex items-start justify-between gap-3 border-b border-line/30 py-1.5 last:border-0">
                            <span className="flex items-center gap-2 text-[13px] text-ink-dim">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} /> {h.label}
                            </span>
                            <span className="text-right text-[13px] font-medium text-ink">{h.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Rendered deliverables (the "UI" outputs) — big */}
              {bindings.length > 0 && populated.length > 0 && (
                <section>
                  <SectionTitle>Rendered deliverables</SectionTitle>
                  <div className="rounded-2xl border border-line bg-white/[0.015] p-5">
                    <UIPreview tables={tables} bindings={bindings} />
                  </div>
                </section>
              )}

              {/* Every output, each flippable rendered ↔ raw, traceable to its node */}
              <section>
                <SectionTitle>All outputs</SectionTitle>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {tables.map((t) => (
                    <OutputCard key={t.id} table={t} bindings={bindings} pipelineNodes={pipeline?.nodes ?? []} onJump={jump} />
                  ))}
                </div>
              </section>

              <div className="flex items-center justify-center pt-1">
                <button
                  onClick={() => {
                    setPanelTab("output");
                    onClose();
                  }}
                  className="text-[12px] text-ink-faint transition hover:text-ink"
                >
                  Back to canvas
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon size={13} className="text-ink-faint" /> {label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-[13px] font-medium text-ink">{children}</h3>;
}

function OutputCard({
  table,
  bindings,
  pipelineNodes,
  onJump,
}: {
  table: OutputTable;
  bindings: UIBinding[];
  pipelineNodes: { id: string; title: string }[];
  onJump: (nodeId?: string) => void;
}) {
  const binding = bindings.find((b) => b.tableId === table.id);
  const [view, setView] = useState<"rendered" | "raw">(binding ? "rendered" : "raw");
  const sourceNode = table.sourceNodeId ? pipelineNodes.find((n) => n.id === table.sourceNodeId) : undefined;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <Table2 size={14} className="shrink-0 text-ink-faint" />
        <span className="truncate font-mono text-[12px] text-ink">{table.name}</span>
        {binding && <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[9px] font-medium text-violet">UI</span>}
        <span className="ml-auto shrink-0 text-[11px] text-ink-faint">
          {table.rows.length} {table.rows.length === 1 ? "row" : "rows"}
        </span>
        {binding && (
          <div className="flex shrink-0 overflow-hidden rounded-md border border-line text-[10.5px]">
            {(["rendered", "raw"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("px-2 py-0.5 capitalize transition", view === v ? "bg-white/[0.1] text-ink" : "text-ink-faint hover:text-ink")}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 p-3.5">
        {table.rows.length === 0 ? (
          <p className="py-4 text-center text-[11.5px] text-ink-faint">No rows.</p>
        ) : view === "rendered" && binding ? (
          <UIPreview tables={[table]} bindings={[binding]} />
        ) : (
          <TableView table={table} />
        )}
      </div>
      {sourceNode && (
        <button
          onClick={() => onJump(sourceNode.id)}
          title={`Highlight ${sourceNode.title} on the canvas`}
          className="flex items-center gap-1 border-t border-line/60 px-3.5 py-2 text-left text-[11px] text-ink-faint transition hover:text-violet"
        >
          powered by <span className="font-medium text-ink-dim">{sourceNode.title}</span>
          <ArrowUpRight size={12} className="ml-auto" />
        </button>
      )}
    </div>
  );
}

function EmptyState({ running, onRun }: { running: boolean; onRun: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/[0.03]">
        <Sparkles size={24} className="text-violet" />
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">Run the pipeline to see results</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-dim">
          Outputs are the deliverable — run the pipeline and watch the tables, deliverables, and the executive output fill in here.
        </p>
      </div>
      <button
        onClick={onRun}
        disabled={running}
        className="flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
      >
        {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} className="fill-current" />}
        {running ? "Running…" : "Run pipeline"}
      </button>
    </div>
  );
}
