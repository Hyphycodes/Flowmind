"use client";

import { useMemo } from "react";
import { Clock, DollarSign, GitCompare, Layers, Sparkles, TriangleAlert, X } from "lucide-react";
import type { Take } from "@/lib/pipeline/schema";
import type { EvalResult } from "@/lib/evals/schema";
import { usePipelineStore } from "@/store/pipelineStore";
import { compareTakes, summarizeRunCost } from "@/lib/takes/build";
import { cn } from "@/lib/ui/cn";

const MODE_LABEL: Record<string, string> = { simulate: "Simulate", live: "Live", hybrid: "Hybrid" };

function scoreColor(s?: number): string {
  if (s == null) return "#6f7088";
  if (s >= 80) return "#34d399";
  if (s >= 60) return "#f5c451";
  return "#fb923c";
}
function statusColor(s: Take["status"]): string {
  return s === "error" ? "#f87171" : s === "warning" ? "#f5c451" : "#34d399";
}
function fmtCost(n?: number): string {
  if (n == null) return "—";
  if (n === 0) return "$0";
  return `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
}
function fmtLatency(ms?: number): string {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function TakesPanel() {
  const takes = usePipelineStore((s) => s.takes);
  const activeTakeId = usePipelineStore((s) => s.activeTakeId);
  const compareTakeIds = usePipelineStore((s) => s.compareTakeIds);
  const selectTake = usePipelineStore((s) => s.selectTake);
  const toggleCompareTake = usePipelineStore((s) => s.toggleCompareTake);
  const clearCompare = usePipelineStore((s) => s.clearCompare);

  const active = activeTakeId ? takes.find((t) => t.id === activeTakeId) : takes[0];
  const comparing = compareTakeIds.length >= 2;
  const compareSet = useMemo(
    () => takes.filter((t) => compareTakeIds.includes(t.id)),
    [takes, compareTakeIds],
  );

  if (takes.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line px-5 text-center">
        <Layers className="mb-3 text-ink-faint" size={20} />
        <p className="text-[13px] text-ink">No takes yet.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          Run the pipeline to save a Take — a run variation you can score and compare.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Layers size={13} className="text-violet" /> Takes
          </h3>
          {compareTakeIds.length > 0 && (
            <button
              onClick={clearCompare}
              className="flex items-center gap-1 text-[11px] text-ink-faint transition hover:text-ink"
            >
              <X size={11} /> Clear compare ({compareTakeIds.length})
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {takes.map((t) => (
            <TakeCard
              key={t.id}
              take={t}
              active={t.id === active?.id}
              comparing={compareTakeIds.includes(t.id)}
              onSelect={() => selectTake(t.id)}
              onToggleCompare={() => toggleCompareTake(t.id)}
            />
          ))}
        </div>
      </section>

      {comparing ? (
        <ComparisonView takes={compareSet} />
      ) : active ? (
        <ActiveTakeDetail take={active} />
      ) : null}
    </div>
  );
}

function TakeCard({
  take: t,
  active,
  comparing,
  onSelect,
  onToggleCompare,
}: {
  take: Take;
  active: boolean;
  comparing: boolean;
  onSelect: () => void;
  onToggleCompare: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-2.5 transition",
        active ? "border-violet/50" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor(t.status) }} />
            <span className="truncate text-[12.5px] font-medium text-ink">{t.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-ink-faint">
            {t.mode && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-dim">{MODE_LABEL[t.mode]}</span>}
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: scoreColor(t.overallScore) }} />
              {t.overallScore ?? 0}/100
            </span>
            <span>{fmtCost(t.costUsd)}</span>
            <span>{fmtLatency(t.latencyMs)}</span>
            {(t.warningCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-gold">
                <TriangleAlert size={9} /> {t.warningCount}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={onToggleCompare}
          title="Add to comparison"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition",
            comparing ? "border-violet/50 bg-violet/15 text-violet" : "border-line text-ink-faint hover:text-ink",
          )}
        >
          <GitCompare size={12} />
        </button>
      </div>
    </div>
  );
}

function ActiveTakeDetail({ take }: { take: Take }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const summary = take.trace ? summarizeRunCost(take.trace) : null;
  const titleOf = (nodeId: string) =>
    nodeId === "__overall__" ? "Overall" : pipeline?.nodes.find((n) => n.id === nodeId)?.title ?? nodeId;
  const overall = take.evalResults.find((r) => r.nodeId === "__overall__");
  const nodeResults = take.evalResults.filter((r) => r.nodeId !== "__overall__");

  return (
    <>
      {summary && (
        <section>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Run Trace</h4>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={DollarSign} label="Total cost" value={fmtCost(take.costUsd ?? summary.totalCostUsd)} />
            <Stat icon={Clock} label="Latency" value={fmtLatency(take.latencyMs ?? summary.totalLatencyMs)} />
            <Stat icon={TriangleAlert} label="Warnings" value={String(take.warningCount ?? summary.warningCount)} />
            <Stat icon={Sparkles} label="Score" value={`${take.overallScore ?? 0}/100`} valueColor={scoreColor(take.overallScore)} />
          </div>
          <div className="mt-2 space-y-1 rounded-lg border border-line bg-black/20 p-2.5 text-[11px]">
            {summary.mostExpensiveTeam && (
              <Row label="Priciest team" value={`${summary.mostExpensiveTeam.name} · ${fmtCost(summary.mostExpensiveTeam.costUsd)}`} />
            )}
            {summary.slowestTeam && (
              <Row label="Slowest team" value={`${summary.slowestTeam.name} · ${fmtLatency(summary.slowestTeam.latencyMs)}`} />
            )}
            <Row label="Models" value={summary.modelsUsed.map((m) => m.replace("claude-", "")).join(", ") || "—"} />
          </div>
        </section>
      )}

      {overall && (
        <section>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Evaluation</h4>
          <EvalCard result={overall} title="Overall" />
        </section>
      )}

      {nodeResults.length > 0 && (
        <section className="space-y-2">
          {nodeResults.map((r) => (
            <EvalCard key={r.nodeId} result={r} title={titleOf(r.nodeId)} />
          ))}
        </section>
      )}
    </>
  );
}

function EvalCard({ result, title }: { result: EvalResult; title: string }) {
  const vColor = result.verdict === "pass" ? "#34d399" : result.verdict === "warn" ? "#f5c451" : "#f87171";
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">{title}</span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded px-1.5 py-0.5 text-[9.5px] capitalize" style={{ background: `${vColor}22`, color: vColor }}>
            {result.verdict}
          </span>
          <span className="font-mono" style={{ color: scoreColor(result.overall) }}>
            {result.overall}
          </span>
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {result.scores.map((s) => (
          <div key={s.dimension} className="flex items-center gap-2">
            <span className="w-[110px] shrink-0 truncate text-[10.5px] text-ink-dim">{s.dimension.replace(/_/g, " ")}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: scoreColor(s.score) }} />
            </div>
            <span className="w-7 shrink-0 text-right font-mono text-[10px] text-ink-faint">{s.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonView({ takes }: { takes: Take[] }) {
  const comparison = useMemo(() => compareTakes(takes), [takes]);

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        <GitCompare size={12} /> Comparing {takes.length} takes
      </h4>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="border-b border-line bg-white/[0.02] text-ink-faint">
              <th className="px-2 py-1.5 text-left font-medium">Take</th>
              <th className="px-2 py-1.5 text-right font-medium">Score</th>
              <th className="px-2 py-1.5 text-right font-medium">Cost</th>
              <th className="px-2 py-1.5 text-right font-medium">Latency</th>
              <th className="px-2 py-1.5 text-right font-medium">Warn</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((r) => (
              <tr key={r.takeId} className={cn("border-b border-line/60 last:border-0", r.best && "bg-violet/[0.06]")}>
                <td className="px-2 py-1.5 text-ink">
                  <div className="flex items-center gap-1.5">
                    {r.best && <span className="rounded bg-violet/20 px-1 text-[8.5px] text-violet">best</span>}
                    <span className="truncate">{r.name}</span>
                  </div>
                  <div className="text-[9px] text-ink-faint">{r.modelsLabel}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono" style={{ color: scoreColor(r.overallScore) }}>{r.overallScore}</td>
                <td className="px-2 py-1.5 text-right text-ink-dim">{fmtCost(r.costUsd)}</td>
                <td className="px-2 py-1.5 text-right text-ink-dim">{fmtLatency(r.latencyMs)}</td>
                <td className="px-2 py-1.5 text-right text-ink-dim">{r.warningCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.dimensions.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-line bg-white/[0.02] p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-ink-faint">By dimension</div>
          {comparison.dimensions.map((d) => (
            <div key={d.dimension} className="flex items-center gap-2">
              <span className="w-[96px] shrink-0 truncate text-[10px] text-ink-dim">{d.dimension.replace(/_/g, " ")}</span>
              <div className="flex flex-1 gap-1">
                {comparison.rows.map((r) => {
                  const v = d.scores[r.takeId];
                  return (
                    <div key={r.takeId} className="flex-1" title={`${r.name}: ${v ?? "—"}`}>
                      <div className="h-4 overflow-hidden rounded bg-white/[0.05]">
                        {v != null && <div className="h-full" style={{ width: `${v}%`, background: scoreColor(v) }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.02] p-2">
      <div className="flex items-center gap-1 text-[10px] text-ink-faint">
        <Icon size={10} /> {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-ink" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-faint">{label}</span>
      <span className="truncate text-ink-dim">{value}</span>
    </div>
  );
}
