"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Clock, Copy, GitMerge, History, Play, RotateCw, Trash2, Webhook, X, Zap } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hasSupabase } from "@/lib/supabase/client";
import { listPipelines, listTriggerRuns, type PipelineSummary } from "@/lib/supabase/queries";
import { newId } from "@/lib/pipeline/validate";
import { triggerSchema, type Trigger, type TriggerRun, type TriggerType } from "@/lib/automation/schema";
import { CRON_PRESETS, cronPreview, isValidCron, nextFire } from "@/lib/automation/cron";
import { formatDuration, formatUsd, timeAgo } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

const TYPE_META: Record<TriggerType, { label: string; icon: typeof Clock }> = {
  schedule: { label: "Schedule", icon: Clock },
  webhook: { label: "Webhook", icon: Webhook },
  pipeline: { label: "After a pipeline", icon: GitMerge },
};

export function TriggersModal() {
  const open = usePipelineStore((s) => s.triggersOpen);
  const close = usePipelineStore((s) => s.closeTriggers);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const triggers = usePipelineStore((s) => s.triggers);
  const hydrateTriggers = usePipelineStore((s) => s.hydrateTriggers);
  const saveTrigger = usePipelineStore((s) => s.saveTrigger);
  const removeTrigger = usePipelineStore((s) => s.removeTrigger);
  const toggleTrigger = usePipelineStore((s) => s.toggleTrigger);
  const runTriggerNow = usePipelineStore((s) => s.runTriggerNow);

  const [addType, setAddType] = useState<TriggerType>("schedule");
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [alertUrl, setAlertUrl] = useState("");

  // Wrap creation so a (shared, optional) alert webhook is attached to whatever trigger is created.
  const create = (t: Trigger) =>
    void saveTrigger(
      alertUrl.trim() ? { ...t, alerts: { webhookUrl: alertUrl.trim(), events: ["failure", "recovery"] } } : t,
    );

  useEffect(() => {
    if (!open) return;
    void hydrateTriggers();
    if (hasSupabase()) void listPipelines().then(setPipelines);
  }, [open, hydrateTriggers]);

  if (!open || !pipeline) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[14px] font-medium text-ink">
            <Zap size={15} className="text-violet" /> Automate “{pipeline.name}”
          </h2>
          <button onClick={close} aria-label="Close" className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {!hasSupabase() && (
            <p className="rounded-lg border border-gold/30 bg-gold/[0.06] p-2.5 text-[11.5px] text-ink-dim">
              Triggers need Supabase to persist and a deployed cron to fire. Set up the database to enable automation.
            </p>
          )}

          {/* Existing triggers */}
          {triggers.length > 0 && (
            <div className="space-y-2">
              {triggers.map((t) => (
                <TriggerRow
                  key={t.id}
                  trigger={t}
                  pipelineName={pipelines.find((p) => p.id === t.upstreamPipelineId)?.name}
                  onToggle={() => void toggleTrigger(t.id)}
                  onDelete={() => void removeTrigger(t.id)}
                  onRunNow={() => void runTriggerNow(t.id)}
                />
              ))}
            </div>
          )}

          {/* Add */}
          <div className="rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center gap-1 rounded-lg border border-line bg-black/20 p-1">
              {(Object.keys(TYPE_META) as TriggerType[]).map((tp) => {
                const Icon = TYPE_META[tp].icon;
                return (
                  <button
                    key={tp}
                    onClick={() => setAddType(tp)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition",
                      addType === tp ? "bg-white/[0.08] text-ink" : "text-ink-dim hover:text-ink",
                    )}
                  >
                    <Icon size={12} /> {TYPE_META[tp].label}
                  </button>
                );
              })}
            </div>
            {addType === "schedule" && <ScheduleForm pipelineId={pipeline.id} onCreate={create} />}
            {addType === "webhook" && <WebhookForm pipeline={pipeline} onCreate={create} />}
            {addType === "pipeline" && (
              <PipelineForm pipelineId={pipeline.id} pipelines={pipelines} onCreate={create} />
            )}

            <label className="mt-3 block">
              <span className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <Bell size={11} /> Alert webhook (optional — Slack/Discord/Zapier)
              </span>
              <input
                value={alertUrl}
                onChange={(e) => setAlertUrl(e.target.value)}
                placeholder="https://hooks.slack.com/…"
                className="w-full rounded-lg border border-line bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-line-strong"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function TriggerRow({
  trigger: t,
  pipelineName,
  onToggle,
  onDelete,
  onRunNow,
}: {
  trigger: Trigger;
  pipelineName?: string;
  onToggle: () => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  const Icon = TYPE_META[t.type].icon;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const summary =
    t.type === "schedule"
      ? t.schedule
        ? cronPreview(t.schedule.cron)
        : "Schedule"
      : t.type === "webhook"
        ? "Webhook endpoint"
        : `After ${pipelineName ?? "another pipeline"}`;
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const url = t.type === "webhook" && t.webhook ? `${origin}/api/hooks/${t.webhook.token}` : "";
  const failing = t.lastStatus === "error";

  return (
    <div className={cn("rounded-xl border p-3", t.enabled ? (failing ? "border-red/30 bg-red/[0.04]" : "border-line bg-white/[0.02]") : "border-line bg-white/[0.01] opacity-60")}>
      <div className="flex items-center gap-2.5">
        <Icon size={15} className="shrink-0 text-violet" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-ink">{summary}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-[10.5px]">
            <span className={failing ? "text-red" : "text-ink-faint"}>
              {t.lastFiredAt ? `fired ${timeAgo(t.lastFiredAt)} · ${t.lastStatus ?? ""}` : "not fired yet"}
            </span>
            {t.nextRetryAt && <span className="text-gold">· retry queued</span>}
            {t.alerts?.webhookUrl && <Bell size={9} className="text-ink-faint" />}
          </div>
        </div>
        <button onClick={onRunNow} title="Run now" className="shrink-0 text-ink-faint transition hover:text-ink">
          <Play size={13} className="fill-current" />
        </button>
        <button
          onClick={onToggle}
          title={t.enabled ? "Disable" : "Enable"}
          className={cn("relative h-5 w-9 shrink-0 rounded-full transition", t.enabled ? "bg-violet" : "bg-white/[0.12]")}
        >
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", t.enabled ? "left-[18px]" : "left-0.5")} />
        </button>
        <button onClick={onDelete} aria-label="Delete" className="shrink-0 text-ink-faint transition hover:text-red">
          <Trash2 size={14} />
        </button>
      </div>

      {failing && t.lastError && <p className="mt-1.5 line-clamp-2 text-[10.5px] text-red/90">{t.lastError}</p>}

      {url && (
        <div className="mt-2 flex items-center gap-2">
          <input readOnly value={url} className="flex-1 truncate rounded-lg border border-line bg-black/30 px-2.5 py-1.5 font-mono text-[10.5px] text-ink-dim" />
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-lg border border-line-strong bg-white/[0.04] p-1.5 text-ink-dim transition hover:text-ink"
          >
            {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10.5px]">
        <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1 text-ink-faint transition hover:text-ink">
          <History size={11} /> History
        </button>
        {failing && (
          <button onClick={onRunNow} className="flex items-center gap-1 text-violet transition hover:brightness-110">
            <RotateCw size={11} /> Retry now
          </button>
        )}
      </div>

      {showHistory && <TriggerHistory triggerId={t.id} />}
    </div>
  );
}

function TriggerHistory({ triggerId }: { triggerId: string }) {
  const [runs, setRuns] = useState<TriggerRun[] | null>(hasSupabase() ? null : []);
  useEffect(() => {
    let cancelled = false;
    if (hasSupabase()) void listTriggerRuns(triggerId).then((r) => !cancelled && setRuns(r));
    return () => {
      cancelled = true;
    };
  }, [triggerId]);

  if (runs === null) return <p className="mt-2 text-[10.5px] text-ink-faint">Loading history…</p>;
  if (runs.length === 0) return <p className="mt-2 text-[10.5px] text-ink-faint">No firings recorded yet.</p>;
  const ok = runs.filter((r) => r.status === "success").length;

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-line bg-black/20 p-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">
        {runs.length} firings · {ok} ok · {runs.length - ok} failed
      </div>
      {runs.slice(0, 8).map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-[10.5px]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.status === "success" ? "#34d399" : "#f87171" }} />
          <span className="text-ink-dim">{timeAgo(r.createdAt)}</span>
          {r.attempt > 1 && <span className="text-gold">·a{r.attempt}</span>}
          <span className="text-ink-faint">{formatDuration(r.durationMs ?? 0)}</span>
          {r.costUsd != null && <span className="text-ink-faint">{formatUsd(r.costUsd)}</span>}
          {r.error && <span className="min-w-0 flex-1 truncate text-red/80">{r.error}</span>}
        </div>
      ))}
    </div>
  );
}

function ScheduleForm({ pipelineId, onCreate }: { pipelineId: string; onCreate: (t: Trigger) => void }) {
  const [cron, setCron] = useState(CRON_PRESETS[0].cron);
  const [timezone, setTimezone] = useState(typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  const valid = isValidCron(cron);
  const next = useMemo(() => (valid ? nextFire(cron, timezone) : null), [cron, timezone, valid]);

  const create = () => {
    if (!valid) return;
    onCreate(
      triggerSchema.parse({ id: newId("trig"), pipelineId, type: "schedule", enabled: true, schedule: { cron, timezone } }),
    );
  };

  return (
    <div className="space-y-2.5">
      <select value={cron} onChange={(e) => setCron(e.target.value)} className="w-full rounded-lg border border-line bg-black/30 px-2.5 py-2 text-[12.5px] text-ink outline-none">
        {CRON_PRESETS.map((p) => (
          <option key={p.cron} value={p.cron} className="bg-[#14141c]">
            {p.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="* * * * *" className="flex-1 rounded-lg border border-line bg-black/30 px-2.5 py-2 font-mono text-[12px] text-ink outline-none focus:border-line-strong" />
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" className="w-40 rounded-lg border border-line bg-black/30 px-2.5 py-2 text-[12px] text-ink outline-none focus:border-line-strong" />
      </div>
      <p className="text-[11.5px] text-ink-dim">
        {valid ? cronPreview(cron) : "Enter a 5-field cron expression."}
        {next && <span className="text-ink-faint"> · next {next.toLocaleString()}</span>}
      </p>
      <button onClick={create} disabled={!valid} className="w-full rounded-lg bg-violet py-2 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50">
        Add schedule
      </button>
    </div>
  );
}

function WebhookForm({ pipeline, onCreate }: { pipeline: { id: string; mockInputs: { key: string; label: string }[] }; onCreate: (t: Trigger) => void }) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const create = () => {
    const token = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : newId("tok")).replace(/-/g, "");
    const inputMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(mapping)) if (v.trim()) inputMapping[k] = v.trim();
    onCreate(triggerSchema.parse({ id: newId("trig"), pipelineId: pipeline.id, type: "webhook", enabled: true, webhook: { token, inputMapping } }));
  };
  return (
    <div className="space-y-2.5">
      <p className="text-[11.5px] text-ink-dim">An external system POSTs JSON to wake this pipeline. Map body fields to inputs (optional — matching keys are used by default).</p>
      {pipeline.mockInputs.length > 0 && (
        <div className="space-y-1.5">
          {pipeline.mockInputs.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate font-mono text-[11px] text-ink-dim">{f.key}</span>
              <span className="text-ink-faint">←</span>
              <input
                value={mapping[f.key] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                placeholder={`body.${f.key}`}
                className="flex-1 rounded-lg border border-line bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-line-strong"
              />
            </div>
          ))}
        </div>
      )}
      <button onClick={create} className="w-full rounded-lg bg-violet py-2 text-[12.5px] font-medium text-white transition hover:bg-violet/90">
        Create webhook
      </button>
    </div>
  );
}

function PipelineForm({ pipelineId, pipelines, onCreate }: { pipelineId: string; pipelines: PipelineSummary[]; onCreate: (t: Trigger) => void }) {
  const others = pipelines.filter((p) => p.id !== pipelineId);
  const [upstream, setUpstream] = useState("");
  const create = () => {
    if (!upstream) return;
    onCreate(triggerSchema.parse({ id: newId("trig"), pipelineId, type: "pipeline", enabled: true, upstreamPipelineId: upstream }));
  };
  return (
    <div className="space-y-2.5">
      <p className="text-[11.5px] text-ink-dim">Run this pipeline after another one finishes successfully (outputs pass through as inputs).</p>
      {others.length === 0 ? (
        <p className="text-[11.5px] text-ink-faint">No other pipelines to chain from yet.</p>
      ) : (
        <>
          <select value={upstream} onChange={(e) => setUpstream(e.target.value)} className="w-full rounded-lg border border-line bg-black/30 px-2.5 py-2 text-[12.5px] text-ink outline-none">
            <option value="" className="bg-[#14141c]">
              Choose an upstream pipeline…
            </option>
            {others.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#14141c]">
                {p.name}
              </option>
            ))}
          </select>
          <button onClick={create} disabled={!upstream} className="w-full rounded-lg bg-violet py-2 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50">
            Add pipeline trigger
          </button>
        </>
      )}
    </div>
  );
}
