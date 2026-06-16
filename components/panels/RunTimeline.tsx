"use client";

import { Clock, DollarSign } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { nodeMetrics, totalCost, totalDuration } from "@/lib/trace/metrics";
import { formatDuration, formatUsd } from "@/lib/ui/format";
import { useAiAvailable } from "@/lib/ai/useAiAvailable";
import { ExplainButton } from "@/components/canvas/ExplainButton";

const STATUS_COLOR: Record<string, string> = {
  success: "#8b5cf6",
  running: "#4f8bff",
  error: "#f87171",
  idle: "#3a3a48",
};

/** Run timeline (waterfall): one row per executed node/agent in order, a bar proportional to
 *  duration, cost on the right, totals on top. Click a row to select that node on the canvas. */
export function RunTimeline() {
  const steps = usePipelineStore((s) => s.steps);
  const agentRunTraces = usePipelineStore((s) => s.agentRunTraces);
  const teamRunTraces = usePipelineStore((s) => s.teamRunTraces);
  const activeRunTrace = usePipelineStore((s) => s.activeRunTrace);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const aiAvailable = useAiAvailable();

  const executed = steps.filter((s) => s.status !== "idle");
  if (executed.length === 0) {
    return <p className="text-[11.5px] text-ink-faint">Run the pipeline to see the timeline.</p>;
  }

  const metrics = nodeMetrics(steps, agentRunTraces, teamRunTraces);
  const maxDur = Math.max(1, ...executed.map((s) => s.durationMs ?? 0));
  const totalDur = totalDuration(steps);
  const totalUsd = totalCost(steps, activeRunTrace?.costUsd);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-ink-dim">
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-ink-faint" /> {formatDuration(totalDur)}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign size={11} className="text-ink-faint" /> {formatUsd(totalUsd)}
          </span>
        </div>
        {aiAvailable && <ExplainButton scope="run" />}
      </div>

      <div className="space-y-1.5">
        {executed.map((s) => {
          const m = metrics.get(s.nodeId);
          const cost = m?.costUsd;
          const pct = Math.max(3, Math.round(((s.durationMs ?? 0) / maxDur) * 100));
          const color = STATUS_COLOR[s.status] ?? STATUS_COLOR.idle;
          return (
            <button
              key={s.nodeId}
              type="button"
              onClick={() => selectNode(s.nodeId)}
              className="group w-full rounded-lg border border-line bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-line-strong"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate text-[11.5px] font-medium text-ink">{s.title}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-faint">
                  {formatDuration(s.durationMs)}
                  {cost != null && <span className="ml-2 text-ink-dim">{formatUsd(cost)}</span>}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className={s.status === "running" ? "h-full animate-pulse rounded-full" : "h-full rounded-full"}
                  style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
