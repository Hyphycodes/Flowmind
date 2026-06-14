"use client";

import { useMemo, useState } from "react";
import { Check, Download, FileCheck2, GitBranch, GitPullRequest, Loader2, Minus, Package, TriangleAlert, X, XCircle } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { EXPORT_MODE_META, EXPORT_MODES, type ExportHealthStatus, type ExportMode } from "@/lib/export/schema";
import { GitHubExportPanel } from "@/components/github/GitHubExportPanel";
import { GithubMark } from "@/components/github/GithubMark";
import { CreditEstimate } from "@/components/billing/CreditEstimate";
import { cn } from "@/lib/ui/cn";

type Destination = "download" | "github_branch" | "github_pr";

const DESTINATIONS: { id: Destination; label: string; icon: typeof Download }[] = [
  { id: "download", label: "Download ZIP", icon: Download },
  { id: "github_branch", label: "Push to GitHub", icon: GitBranch },
  { id: "github_pr", label: "Create PR", icon: GitPullRequest },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  ready: { label: "Ready", color: "#34d399" },
  warning: { label: "Warnings", color: "#f5c451" },
  blocked: { label: "Blocked", color: "#f87171" },
};

function CheckIcon({ status }: { status: ExportHealthStatus }) {
  if (status === "pass") return <Check size={12} className="text-green" />;
  if (status === "warning") return <TriangleAlert size={12} className="text-gold" />;
  if (status === "fail") return <XCircle size={12} className="text-red" />;
  return <Minus size={12} className="text-ink-faint" />;
}

export function ExportDialog() {
  const open = usePipelineStore((s) => s.exportOpen);
  const exporting = usePipelineStore((s) => s.exporting);
  const health = usePipelineStore((s) => s.exportHealth);
  const manifest = usePipelineStore((s) => s.lastExportManifest);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const runExport = usePipelineStore((s) => s.runExport);
  const closeExport = usePipelineStore((s) => s.closeExport);
  const setNotice = usePipelineStore((s) => s.setNotice);

  const [selected, setSelected] = useState<Set<ExportMode>>(new Set(EXPORT_MODES));
  const [destination, setDestination] = useState<Destination>("download");
  const isGitHub = destination !== "download";

  const blocked = health?.status === "blocked";
  const fileTypeCounts = useMemo(() => {
    if (!manifest) return null;
    const c: Record<string, number> = {};
    for (const f of manifest.files) c[f.type] = (c[f.type] ?? 0) + 1;
    return c;
  }, [manifest]);

  if (!open) return null;

  const toggle = (m: ExportMode) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  const copySummary = async () => {
    const lines = [
      `${pipeline?.name ?? "Pipeline"} — Flowmind export`,
      health ? `Readiness: ${STATUS_META[health.status]?.label} (${health.score}%)` : "",
      `Modes: ${[...selected].map((m) => EXPORT_MODE_META[m].label).join(", ")}`,
      health?.missingItems.length ? `Missing: ${health.missingItems.join(", ")}` : "",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setNotice("Copied export summary.");
    } catch {
      setNotice("Could not copy.");
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm" onClick={closeExport}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fade-up relative flex max-h-full w-[520px] flex-col overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/15 text-violet">
              <Package size={15} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-ink">Export</div>
              <div className="text-[10.5px] text-ink-faint">{pipeline?.name ?? "Pipeline"} → build, present, sell, or ship it</div>
            </div>
          </div>
          <button onClick={closeExport} className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </div>

        {/* Destination tabs */}
        <div className="flex items-center gap-1 border-b border-line px-3 py-2">
          {DESTINATIONS.map((d) => {
            const on = destination === d.id;
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onClick={() => setDestination(d.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] transition",
                  on ? "bg-violet/15 text-violet" : "text-ink-faint hover:text-ink",
                )}
              >
                {d.id !== "download" ? <GithubMark size={12} /> : <Icon size={12} />}
                {d.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
          {/* Health check */}
          {health && (
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  <FileCheck2 size={12} /> Export readiness
                </span>
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: STATUS_META[health.status]?.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[health.status]?.color }} />
                  {STATUS_META[health.status]?.label} · {health.score}%
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {health.checks.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5" title={c.message}>
                    <CheckIcon status={c.status} />
                    <span className="truncate text-[10.5px] text-ink-dim">{c.label}</span>
                  </div>
                ))}
              </div>
              {blocked && (
                <p className="mt-2 text-[10.5px] text-red">
                  Export is blocked: {health.missingItems.join(", ") || "the pipeline is incomplete"}.
                </p>
              )}
            </div>
          )}

          {/* Mode cards */}
          <div className="space-y-1.5">
            {EXPORT_MODES.map((m) => {
              const meta = EXPORT_MODE_META[m];
              const on = selected.has(m);
              return (
                <button
                  key={m}
                  onClick={() => toggle(m)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition",
                    on ? "border-violet/50 bg-violet/[0.06]" : "border-line bg-white/[0.02] hover:border-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      on ? "border-violet bg-violet text-white" : "border-line-strong",
                    )}
                  >
                    {on && <Check size={11} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[12.5px] font-medium text-ink">{meta.label}</span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-ink-faint">{meta.audience}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-dim">{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <CreditEstimate
            request={{
              kind: "export",
              modes: [...selected],
              regenerateDocs: true,
              githubPr: destination === "github_pr",
            }}
          />

          {isGitHub && (
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <GitHubExportPanel modes={[...selected]} createPullRequest={destination === "github_pr"} />
            </div>
          )}

          {!isGitHub && manifest && (
            <div className="rounded-xl border border-violet/30 bg-violet/[0.05] p-2.5 text-[11.5px]">
              <div className="flex items-center gap-1.5 text-ink">
                <Download size={13} className="text-violet" /> Exported {manifest.fileCount} files
              </div>
              {fileTypeCounts && (
                <div className="mt-1 text-[10.5px] text-ink-faint">
                  {Object.entries(fileTypeCounts).map(([t, n]) => `${n} ${t}`).join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3">
          <button onClick={copySummary} className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ink-dim transition hover:text-ink">
            Copy summary
          </button>
          <div className="flex-1" />
          {isGitHub ? (
            <span className="text-[10.5px] text-ink-faint">{selected.size} mode(s) included in the repo export</span>
          ) : (
            <>
              <button
                onClick={() => void runExport([...EXPORT_MODES])}
                disabled={exporting || blocked}
                className="rounded-lg border border-line-strong bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                Export all
              </button>
              <button
                onClick={() => void runExport([...selected])}
                disabled={exporting || blocked || selected.size === 0}
                className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
              >
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Export selected
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
