import { z } from "zod";

/** Canonical Flowmind schemas. Everything that renders, runs, persists, or exports
 *  flows through these. Keep this the single source of truth.
 *
 *  Mental model: Source → Brain → Surface.
 *    Source  = where data comes from (APIs, Input Studio datasets, uploads, memory…)
 *    Brain   = what intelligence does (agents, teams, routers, judges…)
 *    Surface = how it becomes usable (output tables, UI bindings, exports…)
 *
 *  All upgrade fields are additive + optional so existing pipelines stay valid. */

export const NODE_TYPES = [
  "input",
  "agent",
  "tool",
  "transformer",
  "evaluator",
  "output",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/** Source / Brain / Surface layer a node belongs to. */
export const LAYERS = ["source", "brain", "surface"] as const;
export type Layer = (typeof LAYERS)[number];

export const NODE_STATUS = ["idle", "running", "success", "error"] as const;
export type NodeStatus = (typeof NODE_STATUS)[number];

export const ACCENTS = [
  "violet",
  "blue",
  "cyan",
  "teal",
  "green",
  "gold",
  "orange",
  "pink",
  "red",
  "slate",
] as const;

/** Crew strategies a Team Node can run. V1 may execute simplified versions. */
export const TEAM_STRATEGIES = [
  "single",
  "sequential",
  "parallel",
  "debate",
  "vote",
  "router",
  "council",
] as const;
export type TeamStrategy = (typeof TEAM_STRATEGIES)[number];

/** Where a Source node gets its data. */
export const SOURCE_MODES = [
  "live_api",
  "input_studio",
  "uploaded_file",
  "manual_table",
  "previous_take",
  "memory",
  "webhook",
  "database",
] as const;
export type InputSourceMode = (typeof SOURCE_MODES)[number];

export const COMPONENT_TYPES = [
  "metricCards",
  "recordList",
  "summaryCard",
  "detailPanel",
  "jsonViewer",
  "dataTable",
  "cardGrid",
  "timeline",
  "checklist",
  "calendar",
  "comparisonTable",
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const positionSchema = z.object({ x: z.number(), y: z.number() });

/* ── Brain: agents + teams ───────────────────────────────────────────── */

/** A single agent. A node has one today; `team.agents` makes a node a crew. */
export const agentConfigSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  role: z.string().default(""),
  prompt: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
  /** crew-room runtime/metadata (all optional) */
  isLead: z.boolean().optional(),
  muted: z.boolean().optional(),
  status: z.enum(NODE_STATUS).optional(),
  summary: z.string().optional(),
  confidence: z.number().optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const teamSchema = z.object({
  strategy: z.enum(TEAM_STRATEGIES).default("sequential"),
  agents: z.array(agentConfigSchema).default([]),
  /** agent id of the lead / synthesizer / chair */
  lead: z.string().optional(),
  /** internal consultation edges between agents (Crew Room) */
  internalEdges: z
    .array(z.object({ source: z.string(), target: z.string() }))
    .default([]),
});
export type Team = z.infer<typeof teamSchema>;

/* ── Source config ───────────────────────────────────────────────────── */

export const sourceConfigSchema = z.object({
  mode: z.enum(SOURCE_MODES).default("input_studio"),
  datasetId: z.string().optional(),
  toolId: z.string().optional(),
  endpoint: z.string().optional(),
  prompt: z.string().optional(),
  rowCount: z.number().optional(),
  config: z.record(z.any()).optional(),
});
export type SourceConfig = z.infer<typeof sourceConfigSchema>;

/* ── Nodes ───────────────────────────────────────────────────────────── */

export const pipelineNodeSchema = z.object({
  id: z.string(),
  type: z.enum(NODE_TYPES),
  title: z.string(),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  role: z.string().default(""),
  prompt: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
  fallbackModel: z.string().optional(),
  color: z.enum(ACCENTS).optional(),
  position: positionSchema.default({ x: 0, y: 0 }),
  /** keys this node consumes / emits (drive the input/output chips + tables) */
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  status: z.enum(NODE_STATUS).default("idle"),
  /** Source / Brain / Surface layer (optional, for grouping + labels) */
  layer: z.enum(LAYERS).optional(),
  /** Source nodes: where the data comes from. */
  source: sourceConfigSchema.optional(),
  /** Evaluator/judge nodes: which dimensions to score. */
  evalDimensions: z.array(z.string()).optional(),
  /** When present, this node is a Team Node (crew of agents → Crew Room). */
  team: teamSchema.optional(),
});
export type PipelineNode = z.infer<typeof pipelineNodeSchema>;

/* ── Data contracts (edges) ──────────────────────────────────────────── */

export const contractFieldSchema = z.object({
  key: z.string(),
  type: z.string().default("string"),
  required: z.boolean().default(false),
  description: z.string().optional(),
});
export type ContractField = z.infer<typeof contractFieldSchema>;

export const dataContractSchema = z.object({
  expects: z.array(contractFieldSchema).default([]),
  provides: z.array(contractFieldSchema).default([]),
  status: z.enum(["ok", "warning", "error", "unknown"]).default("unknown"),
  notes: z.string().optional(),
});
export type DataContract = z.infer<typeof dataContractSchema>;

export const pipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
  label: z.string().optional(),
  dataKey: z.string().optional(),
  animated: z.boolean().default(false),
  /** field-level contract between the two nodes */
  contract: dataContractSchema.optional(),
  /** id of the Handoff Packet that flows along this edge */
  packetId: z.string().optional(),
});
export type PipelineEdge = z.infer<typeof pipelineEdgeSchema>;

/* ── Handoff Packets ─────────────────────────────────────────────────── */

export const fieldChangesSchema = z.object({
  added: z.array(z.string()).default([]),
  compressed: z.array(z.string()).default([]),
  dropped: z.array(z.string()).default([]),
});

export const handoffPacketSchema = z.object({
  packetId: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string().optional(),
  summary: z.string().default(""),
  keyFields: z.record(z.any()).default({}),
  confidence: z.number().default(0),
  assumptions: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  sourceReferences: z.array(z.string()).default([]),
  fieldChanges: fieldChangesSchema.default({ added: [], compressed: [], dropped: [] }),
  nextAction: z.string().optional(),
});
export type HandoffPacket = z.infer<typeof handoffPacketSchema>;

export const packetWarningSchema = z.object({
  id: z.string(),
  packetId: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string().optional(),
  severity: z.enum(["info", "warning", "error"]).default("warning"),
  message: z.string(),
  field: z.string().optional(),
});
export type PacketWarning = z.infer<typeof packetWarningSchema>;

/* ── Surface: tables + UI bindings ───────────────────────────────────── */

export const tableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z
    .enum(["text", "number", "currency", "percent", "badge", "date"])
    .default("text"),
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

export const outputTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceNodeId: z.string().optional(),
  description: z.string().default(""),
  columns: z.array(tableColumnSchema).default([]),
  rows: z.array(z.record(z.any())).default([]),
  /** optional metadata (first-class table objects) */
  rowCount: z.number().optional(),
  version: z.number().optional(),
  qualityScore: z.number().optional(),
  createdByTakeId: z.string().optional(),
});
export type OutputTable = z.infer<typeof outputTableSchema>;

export const uiBindingSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  componentType: z.enum(COMPONENT_TYPES),
  title: z.string().default(""),
  position: z.number().default(0),
  fields: z.array(z.string()).default([]),
  /** optional presentation config */
  displayName: z.string().optional(),
  formatting: z.record(z.string()).optional(),
  sort: z.object({ key: z.string(), dir: z.enum(["asc", "desc"]) }).optional(),
  visible: z.boolean().optional(),
});
export type UIBinding = z.infer<typeof uiBindingSchema>;

export const mockInputFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string().default(""),
  placeholder: z.string().optional(),
});
export type MockInputField = z.infer<typeof mockInputFieldSchema>;

export const highlightSchema = z.object({
  label: z.string(),
  value: z.string(),
  accent: z.enum(ACCENTS).optional(),
});
export type Highlight = z.infer<typeof highlightSchema>;

export const finalOutputSchema = z.object({
  title: z.string().default("Result"),
  summary: z.string().default(""),
  highlights: z.array(highlightSchema).default([]),
  raw: z.any().optional(),
});
export type FinalOutput = z.infer<typeof finalOutputSchema>;

/* ── Product Drop + Reality Meter ────────────────────────────────────── */

export const productDropSchema = z.object({
  name: z.string().default(""),
  pitch: z.string().default(""),
  targetUser: z.string().default(""),
  vibeTags: z.array(z.string()).default([]),
  coreValue: z.string().default(""),
  workflowSummary: z.string().default(""),
  keyDataObjects: z.array(z.string()).default([]),
  uiSurfaces: z.array(z.string()).default([]),
  missingApis: z.array(z.string()).default([]),
  fastestMvpPath: z.string().default(""),
  monetization: z.string().default(""),
});
export type ProductDrop = z.infer<typeof productDropSchema>;

const RISK = z.enum(["low", "medium", "high"]);

export const realityMeterSchema = z.object({
  buildability: z.number().default(0),
  missing: z.array(z.string()).default([]),
  hardestPart: z.string().default(""),
  fastestMvpPath: z.string().default(""),
  costRisk: RISK.default("low"),
  complexityRisk: RISK.default("low"),
  dataQualityRisk: RISK.default("low"),
  recommendedNext: z.string().default(""),
  fakeFirst: z.array(z.string()).default([]),
  automateLater: z.array(z.string()).default([]),
});
export type RealityMeter = z.infer<typeof realityMeterSchema>;

/* ── Pipeline (Product Blueprint) ────────────────────────────────────── */

export const pipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  nodes: z.array(pipelineNodeSchema).default([]),
  edges: z.array(pipelineEdgeSchema).default([]),
  mockInputs: z.array(mockInputFieldSchema).default([]),
  outputTables: z.array(outputTableSchema).default([]),
  uiBindings: z.array(uiBindingSchema).default([]),
  runHistory: z.array(z.string()).default([]),
  /** upgrade fields (optional) */
  version: z.number().optional(),
  datasetIds: z.array(z.string()).default([]),
  blueprint: productDropSchema.optional(),
  realityMeter: realityMeterSchema.optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

/* ── Runs + Takes ────────────────────────────────────────────────────── */

export const agentRunTraceSchema = z.object({
  id: z.string(),
  runId: z.string().optional(),
  takeId: z.string().optional(),
  teamNodeId: z.string(),
  agentId: z.string(),
  agentName: z.string(),
  role: z.string().default(""),
  status: z.enum(NODE_STATUS),
  input: z.any().optional(),
  output: z.any().optional(),
  outputSummary: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
  provider: z.string().default("anthropic"),
  prompt: z.string().default(""),
  structuredOutput: z.any().optional(),
  toolCalls: z.array(z.any()).default([]),
  confidence: z.number().optional(),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  latencyMs: z.number().default(0),
  tokenUsage: z
    .object({
      inputTokens: z.number().default(0),
      outputTokens: z.number().default(0),
      totalTokens: z.number().default(0),
    })
    .optional(),
  costUsd: z.number().optional(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
});
export type AgentRunTrace = z.infer<typeof agentRunTraceSchema>;

export const teamRunTraceSchema = z.object({
  id: z.string(),
  runId: z.string().optional(),
  takeId: z.string().optional(),
  teamNodeId: z.string(),
  teamName: z.string(),
  strategy: z.enum(TEAM_STRATEGIES),
  status: z.enum(NODE_STATUS),
  input: z.any().optional(),
  agentRuns: z.array(agentRunTraceSchema).default([]),
  consultationSummary: z.string().default(""),
  disagreements: z.array(z.string()).default([]),
  mergeDecision: z.string().default(""),
  finalOutput: z.any().optional(),
  outputSummary: z.string().default(""),
  handoffPacket: handoffPacketSchema.optional(),
  outputTables: z.array(outputTableSchema).default([]),
  confidence: z.number().optional(),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  latencyMs: z.number().default(0),
  costUsd: z.number().optional(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
});
export type TeamRunTrace = z.infer<typeof teamRunTraceSchema>;

export const runStepSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  status: z.enum(NODE_STATUS),
  input: z.any().optional(),
  output: z.any().optional(),
  summary: z.string().optional(),
  durationMs: z.number().default(0),
  startedAt: z.string().optional(),
  /** upgrade fields (optional) */
  kind: z.enum(["node", "team"]).optional(),
  model: z.string().optional(),
  confidence: z.number().optional(),
  costUsd: z.number().optional(),
  packetId: z.string().optional(),
});
export type RunStep = z.infer<typeof runStepSchema>;

export const runTraceSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  status: z.enum(["idle", "running", "success", "error"]).default("idle"),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  steps: z.array(runStepSchema).default([]),
  tables: z.array(outputTableSchema).default([]),
  finalOutput: finalOutputSchema.optional(),
  /** upgrade fields (optional) */
  packets: z.array(handoffPacketSchema).default([]),
  packetWarnings: z.array(packetWarningSchema).default([]),
  agentRuns: z.array(agentRunTraceSchema).default([]),
  teamRuns: z.array(teamRunTraceSchema).default([]),
  takeId: z.string().optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
});
export type RunTrace = z.infer<typeof runTraceSchema>;

/** A Take is a saved run variation (e.g. "Conservative Scoring", "Cheaper Model"). */
export const takeSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string().default("Take"),
  trace: runTraceSchema.optional(),
  modelSelections: z.record(z.string()).default({}),
  scores: z.record(z.number()).default({}),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
  notes: z.string().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Take = z.infer<typeof takeSchema>;

/** Streamed run event (NDJSON line from /api/run). */
export type RunEvent =
  | { kind: "run-start"; runId: string; order: string[] }
  | { kind: "node-start"; nodeId: string }
  | { kind: "team-start"; teamNodeId: string }
  | { kind: "agent-start"; teamNodeId: string; agentId: string }
  | { kind: "agent-done"; teamNodeId: string; agentTrace: AgentRunTrace }
  | { kind: "team-done"; teamNodeId: string; teamTrace: TeamRunTrace }
  | { kind: "packet"; packet: HandoffPacket; warnings?: PacketWarning[] }
  | {
      kind: "node-done";
      nodeId: string;
      status: NodeStatus;
      summary?: string;
      output?: unknown;
      durationMs: number;
      tables: OutputTable[];
      packet?: HandoffPacket;
    }
  | {
      kind: "run-done";
      status: "success" | "error";
      finalOutput?: FinalOutput;
      error?: string;
      runTrace?: RunTrace;
    };
