import { generateObject } from "ai";
import { z } from "zod";
import { getModelClient, resolveExecutionModel } from "@/lib/ai/client";
import { analyzePacketFieldDrift } from "@/lib/packets/fieldDrift";
import { buildPacket } from "@/lib/packets/packetUtils";
import { estimateCost } from "@/lib/models/providers";
import { getTool } from "@/lib/tools/registry";
import { statusForTool } from "@/lib/tools/status";
import {
  ACCENTS,
  type AgentConfig,
  type AgentRunTrace,
  type FinalOutput,
  type HandoffPacket,
  type OutputTable,
  type PacketWarning,
  type Pipeline,
  type PipelineNode,
  type RunEvent,
  type TableColumn,
  type TeamRunTrace,
} from "./schema";
import { newId } from "./validate";

const COLUMN_TYPES = ["text", "number", "currency", "percent", "badge", "date"] as const;
const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const genTableSchema = z.object({
  name: z.string().describe("table key — use exactly one of the node's declared output keys"),
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(COLUMN_TYPES).default("text"),
      }),
    )
    .min(1),
  rows: z.array(z.record(cellSchema)).default([]),
});

const nodeResultSchema = z.object({
  summary: z.string().describe("one concise sentence describing what this step produced"),
  tables: z.array(genTableSchema).default([]),
});

const finalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  highlights: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        accent: z.enum(ACCENTS).optional(),
      }),
    )
    .default([]),
});

const outputNodeResultSchema = nodeResultSchema.extend({ final: finalSchema.optional() });

const agentResultSchema = z.object({
  output: z.string().describe("The agent's substantive answer or opinion."),
  outputSummary: z.string().describe("One concise sentence summarizing the agent output."),
  structuredOutput: z.record(z.any()).default({}),
  confidence: z.number().min(0).max(1).default(0.72),
  warnings: z.array(z.string()).default([]),
});

const teamSynthesisSchema = nodeResultSchema.extend({
  consultationSummary: z.string().default(""),
  disagreements: z.array(z.string()).default([]),
  mergeDecision: z.string().default(""),
  finalTeamOutput: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.75),
  warnings: z.array(z.string()).default([]),
  final: finalSchema.optional(),
});

const packetDraftSchema = z.object({
  summary: z.string().default(""),
  keyFields: z.record(z.any()).default({}),
  confidence: z.number().min(0).max(1).default(0.7),
  assumptions: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  sourceReferences: z.array(z.string()).default([]),
  fieldChanges: z
    .object({
      added: z.array(z.string()).default([]),
      compressed: z.array(z.string()).default([]),
      dropped: z.array(z.string()).default([]),
    })
    .default({ added: [], compressed: [], dropped: [] }),
  nextAction: z.string().optional(),
});

export type ExecuteContext = {
  pipelineName: string;
  mockInputs: Record<string, string>;
  upstream: Record<string, OutputTable>;
  pipeline?: Pipeline;
  runId?: string;
  toNodeId?: string;
  upstreamFieldKeys?: string[];
  onlyAgentId?: string;
  modelAvailable?: boolean;
  emit?: (event: RunEvent) => void;
};

export type ExecuteResult = {
  summary: string;
  tables: OutputTable[];
  final?: FinalOutput;
  packet?: HandoffPacket;
  packetWarnings?: PacketWarning[];
  agentTraces?: AgentRunTrace[];
  teamTrace?: TeamRunTrace;
};

function normalizeTable(raw: z.infer<typeof genTableSchema>, sourceNodeId: string): OutputTable {
  const columns: TableColumn[] = (raw.columns ?? []).map((c) => ({
    key: c.key,
    label: c.label || c.key,
    type: (COLUMN_TYPES as readonly string[]).includes(c.type) ? (c.type as TableColumn["type"]) : "text",
  }));
  const rows = (raw.rows ?? []).map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = v;
    return out;
  });
  return {
    id: raw.name,
    name: raw.name,
    sourceNodeId,
    description: "",
    columns,
    rows,
  };
}

function rowKeysFromTables(tables: Record<string, OutputTable>): string[] {
  const keys = new Set<string>();
  for (const [tableKey, table] of Object.entries(tables)) {
    keys.add(tableKey);
    for (const c of table.columns) keys.add(c.key);
    for (const row of table.rows.slice(0, 3)) {
      for (const key of Object.keys(row)) keys.add(key);
    }
  }
  return [...keys];
}

function upstreamData(ctx: ExecuteContext): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, table] of Object.entries(ctx.upstream)) data[key] = table.rows;
  return data;
}

function usageFrom(result: unknown) {
  const r = result as {
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    totalUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  };
  const usage = r.usage ?? r.totalUsage;
  if (!usage) return undefined;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
  };
}

function toolContextFor(node: PipelineNode, agent?: AgentConfig): string {
  const attachments: Array<{ toolId: string; mode: string; fallbackDatasetId?: string; useWhen?: string }> = [
    ...(node.source?.toolId
      ? [{ toolId: node.source.toolId, mode: "required", fallbackDatasetId: node.source.fallbackDatasetId }]
      : []),
    ...node.toolAttachments,
    ...(node.team?.toolAttachments ?? []),
    ...(agent?.toolAttachments ?? []),
  ];
  if (!attachments.length) return "No tools attached.";
  return attachments
    .map((attachment) => {
      const tool = getTool(attachment.toolId);
      if (!tool) return `${attachment.toolId}: unknown tool`;
      const status = statusForTool(tool);
      const fallback = attachment.fallbackDatasetId ?? tool.fallbackDatasetId ?? tool.mockDatasetId;
      return [
        `${tool.name} (${tool.category})`,
        `mode: ${attachment.mode}`,
        `status: ${status.status}`,
        status.missingEnvVars.length ? `missing env: ${status.missingEnvVars.join(", ")}` : "ready",
        fallback ? `fallback dataset: ${fallback}` : "",
        attachment.useWhen ? `use when: ${attachment.useWhen}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    })
    .join("\n");
}

function resolveAgentModel(node: PipelineNode, agent: AgentConfig) {
  return resolveExecutionModel(
    agent.modelSelection,
    {
      nodeId: node.id,
      agentId: agent.id,
      nodeType: node.type,
      role: agent.role || node.role,
      structuredOutputRequired: true,
      toolUsageRequired: Boolean(node.toolAttachments.length || node.team?.toolAttachments.length || agent.toolAttachments.length || node.source?.toolId),
      visionRequired: agent.modelSelection?.visionRequired ?? node.modelSelection?.visionRequired,
      costPreference: agent.role.toLowerCase().includes("classif") ? "low" : "medium",
      speedPreference: agent.role.toLowerCase().includes("router") ? "high" : "medium",
      wiredOnly: true,
    },
    node.team?.modelSelection ?? node.modelSelection,
  );
}

function resolveNodeModel(node: PipelineNode) {
  return resolveExecutionModel(node.modelSelection, {
    nodeId: node.id,
    nodeType: node.type,
    role: node.role || node.title,
    structuredOutputRequired: true,
    toolUsageRequired: Boolean(node.toolAttachments.length || node.source?.toolId),
    visionRequired: node.modelSelection?.visionRequired,
    costPreference: node.type === "tool" || node.role.toLowerCase().includes("classif") ? "low" : "medium",
    speedPreference: node.type === "tool" ? "high" : "medium",
    wiredOnly: true,
  });
}

function fallbackPacket(
  node: PipelineNode,
  ctx: ExecuteContext,
  summary: string,
  confidence = 0.66,
  warnings: string[] = [],
): HandoffPacket {
  const tables = Object.fromEntries(
    Object.entries(ctx.upstream).map(([key, table]) => [key, { rowCount: table.rows.length }]),
  );
  return buildPacket({
    packetId: newId("pkt"),
    fromNodeId: node.id,
    toNodeId: ctx.toNodeId,
    summary,
    keyFields: {
      outputs: node.outputs,
      upstreamTables: tables,
      team: node.title,
    },
    confidence,
    assumptions: ["Deterministic packet fallback used because packet synthesis was unavailable."],
    missingData: [],
    warnings,
    sourceReferences: Object.keys(ctx.upstream),
    fieldChanges: {
      added: node.outputs,
      compressed: rowKeysFromTables(ctx.upstream).slice(0, 8),
      dropped: [],
    },
  });
}

function seededTablesFor(node: PipelineNode, ctx: ExecuteContext): OutputTable[] {
  const expected = new Set(node.outputs.length ? node.outputs : [node.id]);
  const seeded =
    ctx.pipeline?.outputTables.filter(
      (table) => expected.has(table.id) || table.sourceNodeId === node.id,
    ) ?? [];
  if (seeded.length) return seeded.map((table) => ({ ...table, sourceNodeId: node.id }));

  const fields = Object.keys(ctx.mockInputs).slice(0, 4);
  return [
    {
      id: node.outputs[0] ?? node.id,
      name: node.outputs[0] ?? node.id,
      sourceNodeId: node.id,
      description: "Deterministic no-key fallback output.",
      columns: [
        { key: "summary", label: "Summary", type: "text" },
        ...fields.map((key) => ({ key, label: key, type: "text" as const })),
      ],
      rows: [
        {
          summary: `${node.title} used seeded data because ANTHROPIC_API_KEY is not set.`,
          ...Object.fromEntries(fields.map((key) => [key, ctx.mockInputs[key]])),
        },
      ],
    },
  ];
}

function deterministicFinal(node: PipelineNode, tables: OutputTable[]): FinalOutput | undefined {
  if (node.type !== "output") return undefined;
  const first = tables[0]?.rows[0] ?? {};
  const highlights = Object.entries(first)
    .slice(0, 4)
    .map(([label, value]) => ({ label, value: String(value) }));
  return {
    title: `${node.title} Result`,
    summary: `${node.title} completed with deterministic seeded output because no Anthropic key is configured.`,
    highlights,
  };
}

async function executeAgent(
  node: PipelineNode,
  agent: AgentConfig,
  ctx: ExecuteContext,
  input: unknown,
): Promise<AgentRunTrace> {
  const started = new Date();
  const resolvedModel = resolveAgentModel(node, agent);
  const modelId = resolvedModel.selectedModelId || agent.model || node.model;
  ctx.emit?.({ kind: "agent-start", teamNodeId: node.id, agentId: agent.id });

  if (ctx.modelAvailable === false || !resolvedModel.ready) {
    const trace: AgentRunTrace = {
      id: newId("agent_run"),
      runId: ctx.runId,
      teamNodeId: node.id,
      agentId: agent.id,
      agentName: agent.name || agent.role || agent.id,
      role: agent.role,
      status: "success",
      input,
      output: `${agent.name || agent.id} inspected seeded team input for ${node.title}.`,
      outputSummary: `${agent.name || agent.id} produced deterministic fallback output.`,
      model: modelId,
      provider: "anthropic",
      prompt: agent.prompt || node.prompt,
      structuredOutput: { fallback: true, upstreamTables: Object.keys(ctx.upstream) },
      toolCalls: [],
      toolTraces: [],
      confidence: 0.58,
      warnings: [
        "Selected model is not ready; deterministic agent fallback used.",
        resolvedModel.reason,
        ...resolvedModel.warnings,
      ],
      errors: [],
      latencyMs: Date.now() - started.getTime(),
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
    };
    ctx.emit?.({ kind: "agent-done", teamNodeId: node.id, agentTrace: trace });
    return trace;
  }

  try {
    const result = await generateObject({
      model: getModelClient(modelId),
      schema: agentResultSchema,
      system:
        "You are an internal agent inside a Flowmind Team Node. Produce specific, decision-useful work for the team's chair. Do not emit placeholder text.",
      prompt: [
        `Pipeline: ${ctx.pipelineName}`,
        `Team: ${node.title} (${node.team?.strategy ?? "single"})`,
        `Agent: ${agent.name || agent.id} — ${agent.role}`,
        `Agent task: ${agent.prompt || node.prompt || node.description || node.title}`,
        `Model choice: ${modelId}. ${resolvedModel.reason}`,
        `Available tools:\n${toolContextFor(node, agent)}`,
        `Pipeline inputs: ${JSON.stringify(ctx.mockInputs)}`,
        `Team input: ${JSON.stringify(input).slice(0, 9000)}`,
        "Return a concise output, a one-sentence summary, structured fields if useful, confidence, and any warnings.",
      ].join("\n"),
      temperature: 0.45,
      maxRetries: 1,
    });
    const usage = usageFrom(result);
    const object = result.object;
    const trace: AgentRunTrace = {
      id: newId("agent_run"),
      runId: ctx.runId,
      teamNodeId: node.id,
      agentId: agent.id,
      agentName: agent.name || agent.role || agent.id,
      role: agent.role,
      status: "success",
      input,
      output: object.output,
      outputSummary: object.outputSummary,
      model: modelId,
      provider: "anthropic",
      prompt: agent.prompt || node.prompt,
      structuredOutput: object.structuredOutput,
      toolCalls: [],
      toolTraces: [],
      confidence: object.confidence,
      warnings: object.warnings,
      errors: [],
      latencyMs: Date.now() - started.getTime(),
      tokenUsage: usage,
      costUsd: usage ? estimateCost(modelId, usage.inputTokens, usage.outputTokens) : undefined,
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
    };
    ctx.emit?.({ kind: "agent-done", teamNodeId: node.id, agentTrace: trace });
    return trace;
  } catch (err) {
    const trace: AgentRunTrace = {
      id: newId("agent_run"),
      runId: ctx.runId,
      teamNodeId: node.id,
      agentId: agent.id,
      agentName: agent.name || agent.role || agent.id,
      role: agent.role,
      status: "error",
      input,
      outputSummary: "Agent failed.",
      model: modelId,
      provider: "anthropic",
      prompt: agent.prompt || node.prompt,
      structuredOutput: {},
      toolCalls: [],
      toolTraces: [],
      warnings: [],
      errors: [(err as Error)?.message ?? "Agent failed"],
      latencyMs: Date.now() - started.getTime(),
      startedAt: started.toISOString(),
      finishedAt: new Date().toISOString(),
    };
    ctx.emit?.({ kind: "agent-done", teamNodeId: node.id, agentTrace: trace });
    return trace;
  }
}

function pickChair(agents: AgentConfig[], node: PipelineNode): AgentConfig | null {
  return (
    agents.find((a) => a.id === node.team?.lead) ??
    agents.find((a) => a.isLead) ??
    agents[agents.length - 1] ??
    null
  );
}

async function runTeamAgents(node: PipelineNode, agents: AgentConfig[], ctx: ExecuteContext) {
  const teamInput = {
    mockInputs: ctx.mockInputs,
    upstream: upstreamData(ctx),
  };
  const strategy = node.team?.strategy ?? "sequential";
  const fallbackWarnings: string[] = [];

  if (ctx.onlyAgentId) {
    const agent = agents.find((a) => a.id === ctx.onlyAgentId) ?? agents[0];
    return {
      traces: agent ? [await executeAgent(node, agent, ctx, teamInput)] : [],
      warnings: ["Solo agent run used the latest team input without running the full crew."],
    };
  }

  if (strategy === "single") {
    const agent = pickChair(agents, node) ?? agents[0];
    return { traces: agent ? [await executeAgent(node, agent, ctx, teamInput)] : [], warnings: fallbackWarnings };
  }

  if (strategy === "sequential") {
    const traces: AgentRunTrace[] = [];
    let input: unknown = teamInput;
    for (const agent of agents) {
      const trace = await executeAgent(node, agent, ctx, input);
      traces.push(trace);
      input = { teamInput, previousAgentOutputs: traces.map((t) => ({ agent: t.agentName, output: t.output })) };
    }
    return { traces, warnings: fallbackWarnings };
  }

  if (strategy === "parallel" || strategy === "council") {
    const traces = await Promise.all(agents.map((agent) => executeAgent(node, agent, ctx, teamInput)));
    return { traces, warnings: fallbackWarnings };
  }

  fallbackWarnings.push(`${strategy} uses the parallel safe fallback in this pass.`);
  const traces = await Promise.all(agents.map((agent) => executeAgent(node, agent, ctx, teamInput)));
  return { traces, warnings: fallbackWarnings };
}

async function synthesizeTeam(
  node: PipelineNode,
  ctx: ExecuteContext,
  agentTraces: AgentRunTrace[],
  fallbackWarnings: string[],
) {
  const expected = node.outputs.length ? node.outputs : [node.id];
  const chair = pickChair(agentTraces.map((t) => ({
    id: t.agentId,
    name: t.agentName,
    role: t.role,
    prompt: t.prompt,
    model: t.model,
    toolAttachments: [],
  })), node);
  const chairModel = chair?.model || node.model;
  const resolvedModel = chair
    ? resolveAgentModel(node, chair)
    : resolveNodeModel(node);
  const synthesisModel = resolvedModel.selectedModelId || chairModel;
  const isOutput = node.type === "output";
  if (ctx.modelAvailable === false || !resolvedModel.ready) {
    const tables = seededTablesFor(node, ctx);
    return {
      object: {
        summary: `${node.title} used deterministic seeded output because ANTHROPIC_API_KEY is not set.`,
        tables: [],
        consultationSummary: agentTraces.map((t) => t.outputSummary).join(" "),
        disagreements: [],
        mergeDecision: "No-key fallback merged seeded output tables with compact agent summaries.",
        finalTeamOutput: `${node.title} fallback output.`,
        confidence: 0.58,
        warnings: [
          ...fallbackWarnings,
          "Selected model is not ready; deterministic team fallback used.",
          resolvedModel.reason,
        ],
        final: deterministicFinal(node, tables),
      },
      tables,
      final: deterministicFinal(node, tables),
      usage: undefined,
      model: chairModel,
      warnings: [
        ...fallbackWarnings,
        "Selected model is not ready; deterministic team fallback used.",
        resolvedModel.reason,
      ],
    };
  }
  const result = await generateObject({
    model: getModelClient(synthesisModel),
    schema: teamSynthesisSchema,
    system:
      "You are the chair of a Flowmind Team Node. Merge internal agent work into a clean team output, output tables, and a concise decision record.",
    prompt: [
      `Pipeline: ${ctx.pipelineName}`,
      `Team: ${node.title} (${node.team?.strategy ?? "single"})`,
      `Team task: ${node.prompt || node.description || node.title}`,
      `Model choice: ${synthesisModel}. ${resolvedModel.reason}`,
      `Available tools:\n${toolContextFor(node)}`,
      `Pipeline inputs: ${JSON.stringify(ctx.mockInputs)}`,
      `Upstream data: ${JSON.stringify(upstreamData(ctx)).slice(0, 7000)}`,
      `Agent traces: ${JSON.stringify(agentTraces.map((t) => ({ agent: t.agentName, role: t.role, output: t.output, summary: t.outputSummary, confidence: t.confidence, warnings: t.warnings }))).slice(0, 10000)}`,
      `Produce these output tables using exactly these names: ${expected.join(", ")}.`,
      "Also include consultationSummary, disagreements, mergeDecision, finalTeamOutput, confidence, and warnings.",
      isOutput
        ? "Because this is an output node, include final: title, 2–3 sentence summary, and 3–5 highlights."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    temperature: 0.4,
    maxRetries: 1,
  });
  const object = result.object;
  const tables = object.tables.map((t) => normalizeTable(t, node.id));
  return {
    object,
    tables,
    final: isOutput ? object.final : undefined,
    usage: usageFrom(result),
    model: synthesisModel,
    warnings: [...fallbackWarnings, ...object.warnings],
  };
}

async function createTeamPacket(
  node: PipelineNode,
  ctx: ExecuteContext,
  teamTrace: TeamRunTrace,
): Promise<HandoffPacket> {
  const resolvedModel = resolveNodeModel(node);
  if (ctx.modelAvailable === false || !resolvedModel.ready) {
    return fallbackPacket(
      node,
      ctx,
      teamTrace.outputSummary,
      teamTrace.confidence ?? 0.58,
      ["Selected model is not ready; deterministic packet fallback used.", resolvedModel.reason],
    );
  }

  try {
    const result = await generateObject({
      model: getModelClient(resolvedModel.selectedModelId || node.model),
      schema: packetDraftSchema,
      system:
        "Create a slim Flowmind Handoff Packet. It should be much smaller than raw agent outputs and useful to the downstream team.",
      prompt: [
        `From team: ${node.title} (${node.id})`,
        `To node: ${ctx.toNodeId ?? "unknown"}`,
        `Team output summary: ${teamTrace.outputSummary}`,
        `Consultation summary: ${teamTrace.consultationSummary}`,
        `Merge decision: ${teamTrace.mergeDecision}`,
        `Output tables: ${JSON.stringify(teamTrace.outputTables.map((t) => ({ id: t.id, columns: t.columns.map((c) => c.key), rowCount: t.rows.length, sample: t.rows[0] }))).slice(0, 5000)}`,
        `Upstream field keys: ${(ctx.upstreamFieldKeys ?? rowKeysFromTables(ctx.upstream)).join(", ")}`,
        "Return summary, keyFields, confidence, assumptions, missingData, warnings, sourceReferences, fieldChanges, and nextAction.",
      ].join("\n"),
      temperature: 0.25,
      maxRetries: 1,
    });
    return buildPacket({
      packetId: newId("pkt"),
      fromNodeId: node.id,
      toNodeId: ctx.toNodeId,
      ...result.object,
    });
  } catch (err) {
    return fallbackPacket(node, ctx, teamTrace.outputSummary, teamTrace.confidence ?? 0.66, [
      (err as Error)?.message ?? "Packet synthesis failed; deterministic fallback used.",
    ]);
  }
}

async function executeTeamNode(node: PipelineNode, ctx: ExecuteContext): Promise<ExecuteResult> {
  const started = new Date();
  const activeAgents = (node.team?.agents ?? []).filter((a) => !a.muted);
  const teamTraceBase = {
    id: newId("team_run"),
    runId: ctx.runId,
    teamNodeId: node.id,
    teamName: node.title,
    strategy: node.team?.strategy ?? "sequential",
    status: "running" as const,
    input: { mockInputs: ctx.mockInputs, upstream: upstreamData(ctx) },
    startedAt: started.toISOString(),
  };
  ctx.emit?.({ kind: "team-start", teamNodeId: node.id });

  if (activeAgents.length === 0) {
    const packet = fallbackPacket(node, ctx, `${node.title} has no active agents.`, 0.35, [
      "No active agents were available for this team.",
    ]);
    const teamTrace: TeamRunTrace = {
      ...teamTraceBase,
      status: "error",
      agentRuns: [],
      toolTraces: [],
      consultationSummary: "",
      disagreements: [],
      mergeDecision: "No active agents.",
      finalOutput: "",
      outputSummary: "No active agents were available.",
      handoffPacket: packet,
      outputTables: [],
      confidence: 0.35,
      warnings: packet.warnings,
      errors: ["No active agents were available."],
      latencyMs: Date.now() - started.getTime(),
      finishedAt: new Date().toISOString(),
    };
    return { summary: teamTrace.outputSummary, tables: [], packet, agentTraces: [], teamTrace };
  }

  const { traces, warnings: strategyWarnings } = await runTeamAgents(node, activeAgents, ctx);
  const synthesis = await synthesizeTeam(node, ctx, traces, strategyWarnings);
  const costUsd =
    traces.reduce((sum, trace) => sum + (trace.costUsd ?? 0), 0) +
    (synthesis.usage ? estimateCost(synthesis.model, synthesis.usage.inputTokens, synthesis.usage.outputTokens) : 0);
  const teamTrace: TeamRunTrace = {
    ...teamTraceBase,
    status: traces.some((t) => t.status === "error") ? "error" : "success",
    agentRuns: traces,
    toolTraces: traces.flatMap((trace) => trace.toolTraces),
    consultationSummary: synthesis.object.consultationSummary,
    disagreements: synthesis.object.disagreements,
    mergeDecision: synthesis.object.mergeDecision,
    finalOutput: synthesis.object.finalTeamOutput,
    outputSummary: synthesis.object.summary,
    outputTables: synthesis.tables,
    confidence: synthesis.object.confidence,
    warnings: synthesis.warnings,
    errors: traces.flatMap((t) => t.errors),
    latencyMs: Date.now() - started.getTime(),
    costUsd,
    finishedAt: new Date().toISOString(),
  };
  const packet = await createTeamPacket(node, ctx, teamTrace);
  const packetWarnings = ctx.pipeline
    ? analyzePacketFieldDrift(ctx.pipeline, packet, ctx.upstreamFieldKeys ?? rowKeysFromTables(ctx.upstream))
    : [];
  teamTrace.handoffPacket = packet;
  ctx.emit?.({ kind: "team-done", teamNodeId: node.id, teamTrace });
  ctx.emit?.({ kind: "packet", packet, warnings: packetWarnings });
  return {
    summary: synthesis.object.summary,
    tables: synthesis.tables,
    final: synthesis.final,
    packet,
    packetWarnings,
    agentTraces: traces,
    teamTrace,
  };
}

/** Execute a single node with real Claude, producing structured table data. */
export async function executeNode(node: PipelineNode, ctx: ExecuteContext): Promise<ExecuteResult> {
  if (node.team) return executeTeamNode(node, ctx);

  const resolvedModel = resolveNodeModel(node);
  const modelId = resolvedModel.selectedModelId || node.model;

  if (ctx.modelAvailable === false || !resolvedModel.ready) {
    const tables = seededTablesFor(node, ctx);
    return {
      summary: `${node.title} used deterministic seeded output because the selected model is not ready.`,
      tables,
      final: deterministicFinal(node, tables),
    };
  }

  const model = getModelClient(modelId);
  const expected = node.outputs.length ? node.outputs : [node.id];
  const isOutput = node.type === "output";
  const schema = isOutput ? outputNodeResultSchema : nodeResultSchema;

  const system =
    "You are one node inside Flowmind, a visual AI agent pipeline. Produce realistic, specific, decision-useful structured data — never placeholders or lorem ipsum. " +
    "Numbers must be plain numbers (e.g. 285000, not \"$285,000\") so the UI can format them. Keep each table tight (1–8 rows). " +
    "Return a table for every requested output key, using those exact key names.";

  const prompt = [
    `Pipeline: ${ctx.pipelineName}`,
    `Node: ${node.title}${node.role ? ` — ${node.role}` : ""} (type: ${node.type})`,
    `Task: ${node.prompt || node.description || node.title}`,
    `Model choice: ${modelId}. ${resolvedModel.reason}`,
    `Available tools:\n${toolContextFor(node)}`,
    `Pipeline inputs: ${JSON.stringify(ctx.mockInputs)}`,
    `Upstream data: ${JSON.stringify(upstreamData(ctx)).slice(0, 7000)}`,
    `Produce these output tables (use exactly these names): ${expected.join(", ")}.`,
    "Each table needs columns (key, label, type) and rows whose object keys match the column keys.",
    isOutput
      ? "Also return `final`: a title, a 2–3 sentence summary, and 3–5 highlights (label + short value)."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { object } = await generateObject({
    model,
    schema,
    system,
    prompt,
    temperature: 0.5,
    maxRetries: 1,
  });

  const tables = (object.tables ?? []).map((t) => normalizeTable(t, node.id));
  const final = isOutput ? (object as z.infer<typeof outputNodeResultSchema>).final : undefined;
  return { summary: object.summary, tables, final };
}
