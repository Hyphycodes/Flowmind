"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PipelineCard } from "@/components/pipelines/PipelineCard";
import { hasSupabase } from "@/lib/supabase/client";
import {
  getLatestRun,
  listPipelines,
  listRuns,
  listTriggers,
  type PipelineSummary,
  type RunSummary,
} from "@/lib/supabase/queries";
import type { Trigger } from "@/lib/automation/schema";
import { formatUsd, timeAgo } from "@/lib/ui/format";
import { withAlpha } from "@/lib/ui/colors";

type RunInfo = { costUsd?: number; status: string; at?: string };

/** Run async work in bounded batches so a fleet of pipelines doesn't fire dozens of requests at once. */
async function runBatched<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

const STATUS_COLOR = (s?: string) => (s === "success" ? "#34d399" : s === "error" ? "#f87171" : "#f5c451");

export function CommandCenter() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineSummary[] | null>(null);
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [runInfo, setRunInfo] = useState<Record<string, RunInfo | null>>({});
  const [costsLoading, setCostsLoading] = useState(false);
  const [triggers, setTriggers] = useState<Trigger[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [pl, rn, tg] = await Promise.all([
        hasSupabase() ? listPipelines() : Promise.resolve([]),
        hasSupabase() ? listRuns(40) : Promise.resolve([]),
        hasSupabase() ? listTriggers() : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setPipelines(pl);
      setRuns(rn);
      setTriggers(tg);
      // Per-pipeline latest run gives cost + authoritative status; fetch progressively, bounded.
      if (pl.length && hasSupabase()) {
        setCostsLoading(true);
        await runBatched(pl, 6, async (p) => {
          const trace = await getLatestRun(p.id);
          if (cancelled) return;
          setRunInfo((m) => ({
            ...m,
            [p.id]: trace ? { costUsd: trace.costUsd, status: trace.status, at: trace.finishedAt ?? trace.startedAt } : null,
          }));
        });
        if (!cancelled) setCostsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = pipelines === null || runs === null;
  const open = (id: string) => router.push(`/editor?open=${id}`);
  const nameOf = (id: string | null) => (id ? pipelines?.find((p) => p.id === id)?.name ?? "Pipeline" : "Pipeline");

  const recentRuns = runs ?? [];
  const successCount = recentRuns.filter((r) => r.status === "success").length;
  const errorCount = recentRuns.filter((r) => r.status === "error").length;

  const spend = useMemo(
    () => Object.values(runInfo).reduce((sum, r) => sum + (r?.costUsd ?? 0), 0),
    [runInfo],
  );

  const needsAttention = useMemo(() => {
    if (!pipelines) return [];
    return pipelines
      .map((p) => ({ p, info: runInfo[p.id] }))
      .filter((x) => x.info?.status === "error")
      .slice(0, 8);
  }, [pipelines, runInfo]);

  const costRanked = useMemo(() => {
    if (!pipelines) return [];
    return pipelines
      .map((p) => ({ p, cost: runInfo[p.id]?.costUsd ?? 0 }))
      .filter((x) => x.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
  }, [pipelines, runInfo]);

  const enabledTriggers = triggers.filter((t) => t.enabled).length;
  const failingTriggers = triggers.filter((t) => t.lastStatus === "error");
  const retriesInFlight = triggers.filter((t) => t.nextRetryAt).length;

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <PageShell title="Command Center" subtitle={date}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-ink-faint" size={20} />
        </div>
      </PageShell>
    );
  }

  const noData = pipelines!.length === 0;

  return (
    <PageShell title="Command Center" subtitle={date}>
      {noData ? (
        <EmptyHome onNew={() => router.push("/editor?new=1")} />
      ) : (
        <div className="space-y-8">
          {/* Fleet status */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={Layers} label="Pipelines" value={String(pipelines!.length)} accent="#8b5cf6" />
            <Tile
              icon={Activity}
              label="Recent runs"
              value={String(recentRuns.length)}
              accent="#4f8bff"
              sub={
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-green">
                    <CheckCircle2 size={11} /> {successCount}
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 text-red">
                      <XCircle size={11} /> {errorCount}
                    </span>
                  )}
                </span>
              }
            />
            <Tile
              icon={DollarSign}
              label="Spend"
              value={formatUsd(spend)}
              accent="#34d399"
              sub={
                <span className="flex items-center gap-1 text-ink-faint">
                  {costsLoading && <Loader2 size={10} className="animate-spin" />} latest run / pipeline
                </span>
              }
            />
            <Tile
              icon={AlertTriangle}
              label="Needs attention"
              value={String(needsAttention.length)}
              accent={needsAttention.length ? "#f87171" : "#6f7088"}
            />
          </section>

          {/* Automation health */}
          {triggers.length > 0 && (
            <section>
              <SectionTitle icon={Zap} title="Automation health" />
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Triggers" value={String(enabledTriggers)} sub="enabled" />
                <MiniStat label="Failing" value={String(failingTriggers.length)} tone={failingTriggers.length ? "#f87171" : undefined} />
                <MiniStat label="Retries queued" value={String(retriesInFlight)} tone={retriesInFlight ? "#f5c451" : undefined} />
              </div>
              {failingTriggers.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {failingTriggers.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => open(t.pipelineId)}
                      className="flex w-full items-center gap-2 rounded-lg border border-red/25 bg-red/[0.05] px-3 py-2 text-left transition hover:bg-red/[0.09]"
                    >
                      <Zap size={13} className="shrink-0 text-red" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{nameOf(t.pipelineId)} — automation failing</span>
                      <span className="shrink-0 text-[10px] text-ink-faint">{t.nextRetryAt ? "retry queued" : timeAgo(t.lastFiredAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Needs attention */}
          {needsAttention.length > 0 && (
            <section>
              <SectionTitle icon={AlertTriangle} title="Needs attention" tint="#f87171" />
              <div className="space-y-2">
                {needsAttention.map(({ p, info }) => (
                  <button
                    key={p.id}
                    onClick={() => open(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-red/25 bg-red/[0.05] px-3.5 py-3 text-left transition hover:bg-red/[0.09]"
                  >
                    <XCircle size={15} className="shrink-0 text-red" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{p.name}</div>
                      <div className="text-[11px] text-ink-faint">Latest run failed · {timeAgo(info?.at)}</div>
                    </div>
                    <ArrowRight size={15} className="shrink-0 text-ink-faint" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Recent activity */}
            <section>
              <SectionTitle icon={Activity} title="Recent activity" />
              {recentRuns.length === 0 ? (
                <Empty text="No runs yet — run a pipeline to see activity here." />
              ) : (
                <div className="space-y-1">
                  {recentRuns.slice(0, 12).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => r.pipelineId && open(r.pipelineId)}
                      disabled={!r.pipelineId}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-left transition hover:border-line-strong disabled:cursor-default"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR(r.status) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-ink">{r.title}</span>
                        <span className="block truncate text-[10.5px] text-ink-faint">{nameOf(r.pipelineId)}</span>
                      </span>
                      {r.source && r.source !== "manual" && (
                        <span className="shrink-0 rounded bg-violet/15 px-1.5 py-0.5 text-[9px] font-medium text-violet">{r.source}</span>
                      )}
                      <span className="shrink-0 text-[10.5px] text-ink-faint">{timeAgo(r.createdAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Cost by pipeline */}
            <section>
              <SectionTitle icon={DollarSign} title="Cost by pipeline" sub="latest run each" />
              {costRanked.length === 0 ? (
                <Empty text={costsLoading ? "Tallying run costs…" : "No run-cost data yet."} />
              ) : (
                <div className="space-y-2.5">
                  {costRanked.map(({ p, cost }) => {
                    const max = costRanked[0].cost || 1;
                    return (
                      <button key={p.id} onClick={() => open(p.id)} className="block w-full text-left">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                          <span className="truncate text-ink-dim">{p.name}</span>
                          <span className="shrink-0 font-mono tabular-nums text-ink">{formatUsd(cost)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(4, (cost / max) * 100)}%`, background: "#34d399", boxShadow: "0 0 8px #34d39966" }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Jump back in */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle icon={Sparkles} title="Jump back in" inline />
              <button
                onClick={() => router.push("/editor?new=1")}
                className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
              >
                <Plus size={15} /> New pipeline
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pipelines!.slice(0, 6).map((p) => (
                <PipelineCard
                  key={p.id}
                  pipeline={p}
                  onOpen={open}
                  footer={runInfo[p.id]?.costUsd ? <span className="text-ink-dim">{formatUsd(runInfo[p.id]!.costUsd)}</span> : undefined}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-[11px] text-ink-faint">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: withAlpha(accent, 0.16), color: accent }}>
          <Icon size={13} />
        </span>
        {label}
      </div>
      <div className="mt-2.5 text-[26px] font-semibold leading-none text-ink">{value}</div>
      {sub ? <div className="mt-1.5 text-[11px]">{sub}</div> : null}
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-ink" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub ? <div className="text-[10px] text-ink-faint">{sub}</div> : null}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  sub,
  tint,
  inline,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  title: string;
  sub?: string;
  tint?: string;
  inline?: boolean;
}) {
  return (
    <h2 className={inline ? "flex items-center gap-2 text-[13px] font-medium text-ink" : "mb-3 flex items-center gap-2 text-[13px] font-medium text-ink"}>
      <Icon size={14} style={tint ? { color: tint } : undefined} className={tint ? undefined : "text-violet"} />
      {title}
      {sub ? <span className="text-[11px] font-normal text-ink-faint">· {sub}</span> : null}
    </h2>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-line px-5 text-center text-[12px] text-ink-faint">
      {text}
    </div>
  );
}

function EmptyHome({ onNew }: { onNew: () => void }) {
  return (
    <div className="mx-auto mt-20 max-w-md text-center">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white/[0.03]">
        <Sparkles className="text-violet" size={20} />
      </div>
      <h1 className="font-display text-[28px] italic leading-tight text-ink">Your command center</h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-dim">
        Once you build pipelines, this is where you watch the fleet — what&apos;s live, what&apos;s failing, and what&apos;s
        costing money. Start with your first one.
      </p>
      <button
        onClick={onNew}
        className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
      >
        <Plus size={16} /> New pipeline
      </button>
    </div>
  );
}
