"use client";

import { useMemo, useState } from "react";
import { Clock, Loader2, Sparkles, TrendingDown, Wand2 } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { analyzeRun, type OptimizeFinding } from "@/lib/optimize/analyze";
import { nodeMetric } from "@/lib/trace/metrics";
import { formatDuration, formatUsd } from "@/lib/ui/format";
import { useAiAvailable } from "@/lib/ai/useAiAvailable";

/** Auto-Optimize (Task 01b): turns the trace into one-click savings. Evidence-backed findings,
 *  each Apply routing through the existing diff/approval flow. Estimates derive from real numbers. */
export function OptimizePanel() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const activeRunTrace = usePipelineStore((s) => s.activeRunTrace);
  const takes = usePipelineStore((s) => s.takes);
  const proposeEdit = usePipelineStore((s) => s.proposeEdit);
  const editing = usePipelineStore((s) => s.editing);

  const findings = useMemo(() => {
    if (!pipeline || !activeRunTrace) return [];
    const prior = takes.find((t) => t.trace && t.trace.id !== activeRunTrace.id)?.trace ?? null;
    return analyzeRun(pipeline, activeRunTrace, prior);
  }, [pipeline, activeRunTrace, takes]);

  if (!activeRunTrace) {
    return <p className="text-[11.5px] text-ink-faint">Run the pipeline to find optimizations.</p>;
  }

  const before = takes[1];
  const after = takes[0];
  const showBeforeAfter = before && after && (before.costUsd != null || before.latencyMs != null);
  const applicable = findings.filter((f) => f.remixAction && f.request);

  const optimizeAll = () => {
    if (applicable.length === 0) return;
    const req = `Apply these optimizations to make this pipeline cheaper/faster:\n${applicable.map((f) => `- ${f.request}`).join("\n")}`;
    void proposeEdit(req);
  };

  return (
    <div className="space-y-3">
      {showBeforeAfter && (
        <div className="flex items-center gap-3 rounded-lg border border-green/25 bg-green/[0.05] px-3 py-2 text-[11.5px]">
          <TrendingDown size={14} className="shrink-0 text-green" />
          <span className="text-ink-dim">
            {formatUsd(before.costUsd)} → <span className="font-medium text-ink">{formatUsd(after.costUsd)}</span> ·{" "}
            {formatDuration(before.latencyMs)} → <span className="font-medium text-ink">{formatDuration(after.latencyMs)}</span>
            <span className="ml-1 text-ink-faint">last two runs</span>
          </span>
        </div>
      )}

      {findings.length === 0 ? (
        <p className="text-[11.5px] text-ink-faint">No optimizations found — this run looks lean.</p>
      ) : (
        <>
          <div className="space-y-2">
            {findings.map((f) => (
              <FindingRow
                key={f.id}
                f={f}
                editing={editing}
                onApply={() => f.remixAction && f.request && void proposeEdit(f.request, { remixAction: f.remixAction })}
              />
            ))}
          </div>
          {applicable.length > 1 && (
            <button
              onClick={optimizeAll}
              disabled={editing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet py-2 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
            >
              <Wand2 size={14} /> Optimize whole pipeline ({applicable.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function FindingRow({ f, onApply, editing }: { f: OptimizeFinding; onApply: () => void; editing: boolean }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const activeRunTrace = usePipelineStore((s) => s.activeRunTrace);
  const aiAvailable = useAiAvailable();
  const [rationale, setRationale] = useState<string | null>(null);
  const [loadingWhy, setLoadingWhy] = useState(false);

  const explainModel = async () => {
    const node = pipeline?.nodes.find((n) => n.id === f.nodeIds[0]);
    if (!node || !activeRunTrace) return;
    setLoadingWhy(true);
    const m = nodeMetric(node.id, activeRunTrace.steps, activeRunTrace.agentRuns, activeRunTrace.teamRuns);
    try {
      const res = await fetch("/api/model-rationale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node: { title: node.title, role: node.role, prompt: node.prompt, model: node.model },
          observed: { costUsd: m?.costUsd, durationMs: m?.durationMs },
        }),
      });
      const j = await res.json().catch(() => ({}));
      setRationale(res.ok ? j.rationale ?? "" : j.error ?? "Couldn't explain.");
    } catch {
      setRationale("Couldn't explain.");
    } finally {
      setLoadingWhy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-ink">{f.title}</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-dim">{f.note}</p>
        </div>
        <div className="shrink-0 text-right">
          {f.estSavingUsd != null && (
            <div className="text-[12px] font-semibold text-green">−{formatUsd(f.estSavingUsd)}<span className="text-[9px] font-normal text-ink-faint"> est.</span></div>
          )}
          {f.estSavingMs != null && (
            <div className="flex items-center justify-end gap-0.5 text-[10.5px] text-ink-faint">
              <Clock size={9} /> −{formatDuration(f.estSavingMs)} est.
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {f.remixAction ? (
          <button
            onClick={onApply}
            disabled={editing}
            className="flex items-center gap-1 rounded-lg border border-violet/40 bg-violet/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-violet transition hover:bg-violet/[0.16] disabled:opacity-50"
          >
            {editing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Apply
          </button>
        ) : (
          <span className="rounded-lg border border-line bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-faint">Caching — flag only</span>
        )}
        <span className="text-[10px] text-ink-faint">{f.confidence} confidence</span>
        {f.kind === "over_modeled" && aiAvailable && !rationale && (
          <button onClick={explainModel} disabled={loadingWhy} className="ml-auto text-[10.5px] text-ink-faint transition hover:text-ink">
            {loadingWhy ? "…" : "Why?"}
          </button>
        )}
      </div>
      {rationale && <p className="mt-2 border-t border-line/50 pt-2 text-[11px] leading-relaxed text-ink-dim">{rationale}</p>}
    </div>
  );
}
