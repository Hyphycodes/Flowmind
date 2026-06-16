"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";

type Flag = { nodeId: string; severity: "info" | "warning" | "error"; message: string };
type ExplainResult = { summary: string; flags: Flag[] };

const SEVERITY: Record<Flag["severity"], { icon: typeof Info; color: string; bg: string; border: string }> = {
  info: { icon: Info, color: "#60a5fa", bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.25)" },
  warning: { icon: AlertTriangle, color: "#f5c451", bg: "rgba(245,196,81,0.06)", border: "rgba(245,196,81,0.25)" },
  error: { icon: AlertCircle, color: "#f87171", bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.3)" },
};

/** Plain-English explanation of a run (or one node) via /api/explain-trace, rendered inline with
 *  flags anchored to the named nodes. Render only when an Anthropic key is available (useAiAvailable). */
export function ExplainButton({ scope, focusId }: { scope: "node" | "run"; focusId?: string }) {
  const activeRunTrace = usePipelineStore((s) => s.activeRunTrace);
  const steps = usePipelineStore((s) => s.steps);
  const agentRunTraces = usePipelineStore((s) => s.agentRunTraces);
  const teamRunTraces = usePipelineStore((s) => s.teamRunTraces);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasRun = Boolean(activeRunTrace) || steps.some((s) => s.status !== "idle");
  if (!hasRun) return null;

  const explain = async () => {
    setLoading(true);
    setError(null);
    const trace = activeRunTrace ?? { steps, agentRuns: agentRunTraces, teamRuns: teamRunTraces, status: "success" };
    try {
      const res = await fetch("/api/explain-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, focusId, trace }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Couldn't explain this run.");
        return;
      }
      setResult(j as ExplainResult);
    } catch (e) {
      setError((e as Error)?.message ?? "Couldn't explain this run.");
    } finally {
      setLoading(false);
    }
  };

  const titleFor = (id: string) => pipeline?.nodes.find((n) => n.id === id)?.title ?? id;

  return (
    <div>
      <button
        type="button"
        onClick={explain}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-violet" />}
        {result ? "Explain again" : "Explain"}
      </button>

      {error && <p className="mt-2 text-[11.5px] text-red">{error}</p>}

      {result && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[12.5px] leading-relaxed text-ink-dim">{result.summary}</p>
          {result.flags.length > 0 && (
            <div className="space-y-1.5">
              {result.flags.map((f, i) => {
                const s = SEVERITY[f.severity] ?? SEVERITY.info;
                const Icon = s.icon;
                return (
                  <button
                    key={`${f.nodeId}-${i}`}
                    type="button"
                    onClick={() => selectNode(f.nodeId)}
                    className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[11.5px] leading-relaxed text-ink-dim transition hover:brightness-110"
                    style={{ background: s.bg, borderColor: s.border }}
                  >
                    <Icon size={13} className="mt-0.5 shrink-0" style={{ color: s.color }} />
                    <span>
                      <span className="font-medium text-ink">{titleFor(f.nodeId)}</span> — {f.message}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
