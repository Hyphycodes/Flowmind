import type { ToolTrace } from "@/lib/pipeline/schema";
import { newId } from "@/lib/pipeline/validate";
import { getTool } from "./registry";
import { statusForTool } from "./status";
import { fieldsToRecord } from "./schema";
import { estimateToolCost } from "./cost";

export type ExecuteToolContext = {
  pipelineId?: string;
  runId?: string;
  nodeId?: string;
  agentId?: string;
  fallbackRows?: unknown[];
};

export type ExecuteToolResult = {
  trace: ToolTrace;
  output?: unknown;
};

export async function executeTool(
  toolId: string,
  input: unknown,
  context: ExecuteToolContext = {},
): Promise<ExecuteToolResult> {
  const started = Date.now();
  const createdAt = new Date().toISOString();
  const tool = getTool(toolId);
  if (!tool) {
    const trace = makeTrace(toolId, toolId, input, "error", createdAt, started, {
      ...context,
      error: "Tool is not registered.",
    });
    return { trace };
  }

  const status = statusForTool(tool);
  if (status.status !== "ready") {
    const fallbackOutput = tool.mockable
      ? {
          fallbackUsed: true,
          fallbackDatasetId: tool.fallbackDatasetId ?? tool.mockDatasetId ?? null,
          rows: context.fallbackRows ?? [],
          reason: `${tool.name} is ${status.status}.`,
        }
      : undefined;
    const trace = makeTrace(tool.id, tool.name, input, fallbackOutput ? "fallback_used" : "skipped", createdAt, started, {
      ...context,
      output: fallbackOutput,
      error: fallbackOutput ? undefined : `${tool.name} is ${status.status}.`,
    });
    return { trace, output: fallbackOutput };
  }

  if (tool.liveHandler?.type === "internal") {
    const output = {
      inputSchema: fieldsToRecord(tool.inputSchema),
      outputSchema: fieldsToRecord(tool.outputSchema),
      rows: context.fallbackRows ?? [],
      note: `${tool.name} internal handler is ready; full implementation can be added per tool.`,
    };
    const trace = makeTrace(tool.id, tool.name, input, "success", createdAt, started, {
      ...context,
      output,
    });
    return { trace, output };
  }

  const output = {
    ready: true,
    note: `${tool.name} is configured. Live external calls are intentionally deferred in this pass.`,
  };
  const trace = makeTrace(tool.id, tool.name, input, "skipped", createdAt, started, {
    ...context,
    output,
  });
  return { trace, output };
}

function makeTrace(
  toolId: string,
  toolName: string,
  input: unknown,
  status: ToolTrace["status"],
  createdAt: string,
  started: number,
  context: ExecuteToolContext & { output?: unknown; error?: string },
): ToolTrace {
  return {
    id: newId("tool_trace"),
    toolId,
    toolName,
    nodeId: context.nodeId,
    agentId: context.agentId,
    input,
    output: context.output,
    status,
    error: context.error,
    latencyMs: Date.now() - started,
    costEstimate: estimateToolCost(toolId, { calls: 1 }),
    createdAt,
  };
}
