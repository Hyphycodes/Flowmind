"use client";

import { createElement, useState } from "react";
import { Loader2, Mic, MicOff, Play, RotateCw, Users, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";
import { SourceLayer } from "./SourceLayer";
import { ModelPicker } from "@/components/models/ModelPicker";
import { ToolAttachPanel } from "@/components/tools/ToolAttachPanel";

export function NodeInspector() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedId = usePipelineStore((s) => s.selectedNodeId);
  const node = pipeline?.nodes.find((n) => n.id === selectedId) ?? null;

  if (!node) return null;
  return <NodeInspectorPanel key={node.id} node={node} />;
}

function NodeInspectorPanel({ node }: { node: NonNullable<ReturnType<typeof usePipelineStore.getState>["pipeline"]>["nodes"][number] }) {
  const selectNode = usePipelineStore((s) => s.selectNode);
  const setNodePrompt = usePipelineStore((s) => s.setNodePrompt);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const rerunTeam = usePipelineStore((s) => s.rerunTeam);
  const runSoloAgent = usePipelineStore((s) => s.runSoloAgent);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const runningAgentId = usePipelineStore((s) => s.runningAgentId);
  const teamRunTraces = usePipelineStore((s) => s.teamRunTraces);
  const agentRunTraces = usePipelineStore((s) => s.agentRunTraces);
  const patchNode = usePipelineStore((s) => s.patchNode);

  const [prompt, setPrompt] = useState(node.prompt ?? "");

  const accent = hexFor({ color: node.color, type: node.type });
  const icon = iconForNode(node);
  const latestTeamTrace = [...teamRunTraces].reverse().find((t) => t.teamNodeId === node.id);
  const agentTraceFor = (agentId: string) =>
    [...agentRunTraces].reverse().find((t) => t.teamNodeId === node.id && t.agentId === agentId);

  return (
    <div className="absolute right-5 top-5 z-30 w-[320px] rounded-2xl p-4 glass-strong fm-fade-up shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: withAlpha(accent, 0.16), color: accent }}
        >
          {createElement(icon, { size: 17, strokeWidth: 1.9 })}
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

      <ModelPicker
        node={node}
        value={node.modelSelection}
        onChange={(modelSelection, model) => patchNode(node.id, { modelSelection, model })}
      />

      <ToolAttachPanel
        node={node}
        onChange={(toolAttachments) => patchNode(node.id, { toolAttachments })}
      />

      {(node.inputs.length > 0 || node.outputs.length > 0) && (
        <div className="mt-3 space-y-2">
          <ChipRow label="Inputs" items={node.inputs} accent={accent} dim />
          <ChipRow label="Outputs" items={node.outputs} accent={accent} />
        </div>
      )}

      {(node.source || node.layer === "source" || node.type === "input" || node.type === "tool") && (
        <SourceLayer node={node} />
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
            {node.team.agents.map((a) => {
              const trace = agentTraceFor(a.id);
              const active = runningAgentId === a.id;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5",
                    a.muted && "opacity-45",
                  )}
                >
                  <div className="flex items-center gap-2">
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
                      {trace ? `${trace.latencyMs}ms` : a.model.replace("claude-", "")}
                    </span>
                    <button
                      onClick={() => void runSoloAgent(node.id, a.id)}
                      disabled={runStatus === "running" || a.muted}
                      title="Run this agent with the latest team input"
                      className="shrink-0 text-ink-faint transition hover:text-ink disabled:opacity-40"
                    >
                      {active ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    </button>
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
                  {trace ? (
                    <div className="mt-1.5 space-y-1 border-t border-line/50 pt-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="capitalize text-ink-faint">{trace.status}</span>
                        {typeof trace.confidence === "number" && (
                          <span className="font-mono text-ink-faint">{Math.round(trace.confidence * 100)}%</span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-[10.5px] leading-relaxed text-ink-dim">
                        {trace.outputSummary || "Agent completed."}
                      </p>
                      {trace.warnings.length > 0 && (
                        <p className="text-[10px] leading-relaxed text-gold">{trace.warnings[0]}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-ink-faint">Sample/static crew member until this team runs.</p>
                  )}
                  <ModelPicker
                    node={node}
                    agent={a}
                    value={a.modelSelection}
                    onChange={(modelSelection, model) =>
                      patchNode(node.id, {
                        team: {
                          ...node.team!,
                          agents: node.team!.agents.map((x) =>
                            x.id === a.id ? { ...x, modelSelection, model } : x,
                          ),
                        },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
          {latestTeamTrace && (
            <div className="mt-2 rounded-lg border border-line bg-black/20 p-2.5">
              <div className="flex items-center justify-between text-[10px] text-ink-faint">
                <span>{latestTeamTrace.status === "success" ? "Latest team trace" : "Team trace"}</span>
                {typeof latestTeamTrace.confidence === "number" && (
                  <span className="font-mono">{Math.round(latestTeamTrace.confidence * 100)}%</span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">
                {latestTeamTrace.consultationSummary || latestTeamTrace.outputSummary}
              </p>
              {latestTeamTrace.mergeDecision && (
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-faint">
                  Merge: {latestTeamTrace.mergeDecision}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => void (node.team ? rerunTeam(node.id) : runPipeline({ onlyNodeId: node.id }))}
        disabled={runStatus === "running"}
        title={node.team ? "Runs this team with latest available upstream input" : "Runs this node"}
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
