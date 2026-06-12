"use client";

import { Plug } from "lucide-react";
import { TOOLS } from "@/lib/tools/registry";
import type { PipelineNode, ToolAttachment } from "@/lib/pipeline/schema";
import { newId } from "@/lib/pipeline/validate";

export function ToolAttachPanel({
  node,
  onChange,
}: {
  node: PipelineNode;
  onChange: (attachments: ToolAttachment[]) => void;
}) {
  const attachments = node.toolAttachments ?? [];

  const addTool = (toolId: string) => {
    if (!toolId || attachments.some((a) => a.toolId === toolId)) return;
    const tool = TOOLS.find((t) => t.id === toolId);
    onChange([
      ...attachments,
      {
        id: newId("tool_attach"),
        toolId,
        nodeId: node.id,
        mode: "available",
        inputMapping: {},
        outputMapping: {},
        fallbackDatasetId: tool?.fallbackDatasetId ?? tool?.mockDatasetId,
      },
    ]);
  };

  const updateMode = (id: string, mode: ToolAttachment["mode"]) => {
    onChange(attachments.map((attachment) => (attachment.id === id ? { ...attachment, mode } : attachment)));
  };

  return (
    <div className="mt-3 rounded-lg border border-line bg-black/20 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          <Plug size={12} /> Tools
        </span>
        <select
          value=""
          onChange={(event) => addTool(event.target.value)}
          className="max-w-[150px] rounded-md border border-line bg-[#11111a] px-1.5 py-1 text-[10.5px] text-ink"
        >
          <option value="">Attach tool</option>
          {TOOLS.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name}
            </option>
          ))}
        </select>
      </div>

      {attachments.length === 0 ? (
        <p className="text-[10.5px] leading-relaxed text-ink-faint">
          No tools attached. Source nodes can still use their Source Mode fallback.
        </p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((attachment) => {
            const tool = TOOLS.find((t) => t.id === attachment.toolId);
            return (
              <div key={attachment.id} className="rounded-md border border-line bg-white/[0.02] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11.5px] text-ink">{tool?.name ?? attachment.toolId}</span>
                  <select
                    value={attachment.mode}
                    onChange={(event) => updateMode(attachment.id, event.target.value as ToolAttachment["mode"])}
                    className="rounded border border-line bg-[#11111a] px-1 py-0.5 text-[10px] text-ink"
                  >
                    <option value="available">available</option>
                    <option value="required">required</option>
                    <option value="disabled">disabled</option>
                  </select>
                </div>
                {(attachment.fallbackDatasetId || tool?.fallbackDatasetId || tool?.mockDatasetId) && (
                  <div className="mt-1 text-[10px] text-ink-faint">
                    fallback: {attachment.fallbackDatasetId ?? tool?.fallbackDatasetId ?? tool?.mockDatasetId}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
