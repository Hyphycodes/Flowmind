"use client";

import { useEffect, useState } from "react";
import { Loader2, Mic, MicOff, RotateCw, Users, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

export function NodeInspector() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedId = usePipelineStore((s) => s.selectedNodeId);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const setNodePrompt = usePipelineStore((s) => s.setNodePrompt);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const patchNode = usePipelineStore((s) => s.patchNode);

  const node = pipeline?.nodes.find((n) => n.id === selectedId) ?? null;
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    setPrompt(node?.prompt ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!node) return null;
  const accent = hexFor({ color: node.color, type: node.type });
  const Icon = iconForNode(node);

  return (
    <div className="absolute right-5 top-5 z-30 w-[320px] rounded-2xl p-4 glass-strong fm-fade-up shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: withAlpha(accent, 0.16), color: accent }}
        >
          <Icon size={17} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{node.title}</div>
          <div className="text-[11px] capitalize text-ink-faint">
            {node.type}
            {node.role ? ` · ${node.role}` : ""}
          </div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="text-ink-faint transition hover:text-ink"
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>

      <label className="mt-4 block text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        Prompt
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => prompt !== node.prompt && setNodePrompt(node.id, prompt)}
        rows={5}
        placeholder="What should this agent do?"
        className="mt-1.5 w-full resize-none rounded-lg border border-line bg-black/30 p-2.5 text-[12px] leading-relaxed text-ink outline-none focus:border-line-strong"
      />

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-ink-faint">Model</span>
        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-ink-dim">{node.model}</span>
      </div>

      {(node.inputs.length > 0 || node.outputs.length > 0) && (
        <div className="mt-3 space-y-2">
          <ChipRow label="Inputs" items={node.inputs} accent={accent} dim />
          <ChipRow label="Outputs" items={node.outputs} accent={accent} />
        </div>
      )}

      {node.team && node.team.agents.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
              <Users size={12} /> Crew Room
            </span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] capitalize text-ink-dim">
              {node.team.strategy}
            </span>
          </div>
          <div className="space-y-1">
            {node.team.agents.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5",
                  a.muted && "opacity-45",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] text-ink">{a.name || a.role || a.id}</span>
                    {a.id === node.team!.lead && (
                      <span className="rounded bg-violet/15 px-1 text-[9px] text-violet">lead</span>
                    )}
                  </div>
                  {a.role && <div className="truncate text-[10px] text-ink-faint">{a.role}</div>}
                </div>
                <span className="shrink-0 font-mono text-[9.5px] text-ink-faint">
                  {a.model.replace("claude-", "")}
                </span>
                <button
                  onClick={() =>
                    patchNode(node.id, {
                      team: {
                        ...node.team!,
                        agents: node.team!.agents.map((x) =>
                          x.id === a.id ? { ...x, muted: !x.muted } : x,
                        ),
                      },
                    })
                  }
                  title={a.muted ? "Unmute agent" : "Mute agent"}
                  className="shrink-0 text-ink-faint transition hover:text-ink"
                >
                  {a.muted ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void runPipeline()}
        disabled={runStatus === "running"}
        title="Re-runs the pipeline with your edits"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-white/[0.04] py-2 text-[13px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
      >
        {runStatus === "running" ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
        {node.team ? "Re-run team" : "Re-run node"}
      </button>
    </div>
  );
}

function ChipRow({
  label,
  items,
  accent,
  dim,
}: {
  label: string;
  items: string[];
  accent: string;
  dim?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-12 shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span
            key={i}
            className="rounded-md px-1.5 py-[2px] font-mono text-[10px]"
            style={{
              background: dim ? "#ffffff0d" : withAlpha(accent, 0.12),
              color: dim ? "#a6a7ba" : accent,
            }}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
