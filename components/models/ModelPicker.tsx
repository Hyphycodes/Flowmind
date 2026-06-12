"use client";

import { Cpu, Sparkles } from "lucide-react";
import { MODELS } from "@/lib/models/providers";
import { recommendModelForAgent, recommendModelForNode } from "@/lib/models/recommend";
import type { AgentConfig, ModelSelection, PipelineNode } from "@/lib/pipeline/schema";
import { cn } from "@/lib/ui/cn";

type Props = {
  node: PipelineNode;
  agent?: AgentConfig;
  value?: ModelSelection;
  onChange: (selection: ModelSelection, modelId: string) => void;
};

export function ModelPicker({ node, agent, value, onChange }: Props) {
  const rec = agent
    ? recommendModelForAgent({
        nodeId: node.id,
        agentId: agent.id,
        nodeType: node.type,
        role: agent.role || node.role,
        structuredOutputRequired: true,
        toolUsageRequired: Boolean(node.toolAttachments.length || node.team?.toolAttachments.length || agent.toolAttachments.length || node.source?.toolId),
        wiredOnly: true,
      })
    : recommendModelForNode({
        nodeId: node.id,
        nodeType: node.type,
        role: node.role || node.title,
        structuredOutputRequired: true,
        toolUsageRequired: Boolean(node.toolAttachments.length || node.source?.toolId),
        wiredOnly: true,
      });
  const selectedId = value?.primaryModelId || agent?.model || node.model || rec.recommendedModelId;
  const selected = MODELS.find((m) => m.id === selectedId) ?? MODELS.find((m) => m.id === rec.recommendedModelId);

  const setMode = (mode: ModelSelection["mode"]) => {
    const modelId = mode === "auto" ? rec.recommendedModelId : selectedId;
    onChange(
      {
        mode,
        primaryModelId: mode === "manual" || mode === "fallback_chain" ? modelId : undefined,
        fallbackModelIds: mode === "fallback_chain" ? rec.fallbackModelIds : [],
        recommendedModelId: rec.recommendedModelId,
        reason: rec.reason,
        structuredOutputRequired: true,
      },
      modelId,
    );
  };

  return (
    <div className="mt-3 rounded-lg border border-line bg-black/20 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          <Cpu size={12} /> Model
        </span>
        <button
          type="button"
          onClick={() =>
            onChange(
              {
                mode: "auto",
                recommendedModelId: rec.recommendedModelId,
                reason: rec.reason,
                fallbackModelIds: rec.fallbackModelIds,
                structuredOutputRequired: true,
              },
              rec.recommendedModelId,
            )
          }
          className="flex items-center gap-1 rounded bg-violet/15 px-1.5 py-0.5 text-[10px] text-violet"
          title={rec.reason}
        >
          <Sparkles size={10} /> Use recommended
        </button>
      </div>

      <div className="flex gap-1">
        {(["auto", "manual", "fallback_chain"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            className={cn(
              "rounded-md px-2 py-1 text-[10.5px] capitalize transition",
              (value?.mode ?? "auto") === mode
                ? "bg-white/[0.08] text-ink"
                : "bg-white/[0.03] text-ink-faint hover:text-ink",
            )}
          >
            {mode === "fallback_chain" ? "Fallbacks" : mode === "auto" ? "Auto-pick" : "Manual"}
          </button>
        ))}
      </div>

      <select
        value={selected?.id ?? selectedId}
        onChange={(e) =>
          onChange(
            {
              mode: "manual",
              primaryModelId: e.target.value,
              fallbackModelIds: rec.fallbackModelIds,
              recommendedModelId: rec.recommendedModelId,
              reason: rec.reason,
              structuredOutputRequired: true,
            },
            e.target.value,
          )
        }
        className="mt-2 w-full rounded-md border border-line bg-[#11111a] px-2 py-1.5 text-[11px] text-ink outline-none"
      >
        {MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.displayName} · {model.costTier} · {model.speedTier}
          </option>
        ))}
      </select>

      <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">{rec.reason}</p>
      {selected && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selected.capabilityTags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] text-ink-dim">
              {tag.replace("_", " ")}
            </span>
          ))}
          {!selected.wired && (
            <span className="rounded bg-gold/[0.12] px-1.5 py-0.5 text-[9.5px] text-gold">
              not wired yet
            </span>
          )}
        </div>
      )}
    </div>
  );
}
