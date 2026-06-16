import { z } from "zod";
import { evalResultSchema } from "@/lib/evals/schema";

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

/** Visible controller nodes the Team Coordinator builds for a strategy
 *  (router selects a member, judge resolves a debate, aggregator merges). */
export const CONTROLLER_KINDS = ["router", "judge", "aggregator"] as const;
export type ControllerKind = (typeof CONTROLLER_KINDS)[number];

/** How a run is executed. simulate = datasets/deterministic; live = real models+tools;
 *  hybrid = live models, dataset/source fallbacks for missing/expensive APIs. */
export const EXECUTION_MODES = ["simulate", "live", "hybrid"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

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
  "google_drive",
  "github_repo",
  "github_file",
  "github_issues",
  "github_pull_requests",
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
  "actionChips",
  "scoreCard",
  "recommendationCards",
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const positionSchema = z.object({ x: z.number(), y: z.number() });

/* ── Models + tools (selection, attachments, traces) ─────────────────── */

export const MODEL_SELECTION_MODES = ["auto", "manual", "inherit", "fallback_chain"] as const;
export type ModelSelectionMode = (typeof MODEL_SELECTION_MODES)[number];

export const modelSelectionSchema = z.object({
  mode: z.enum(MODEL_SELECTION_MODES).default("auto"),
  primaryModelId: z.string().optional(),
  fallbackModelIds: z.array(z.string()).default([]),
  recommendedModelId: z.string().optional(),
  reason: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  structuredOutputRequired: z.boolean().optional(),
  toolCallingRequired: z.boolean().optional(),
  visionRequired: z.boolean().optional(),
});
export type ModelSelection = z.infer<typeof modelSelectionSchema>;

export const toolAttachmentSchema = z.object({
  id: z.string(),
  toolId: z.string(),
  nodeId: z.string().optional(),
  agentId: z.string().optional(),
  mode: z.enum(["available", "required", "disabled"]).default("available"),
  inputMapping: z.record(z.string()).default({}),
  outputMapping: z.record(z.string()).default({}),
  useWhen: z.string().optional(),
  fallbackSourceMode: z.enum(SOURCE_MODES).optional(),
  fallbackDatasetId: z.string().optional(),
});
export type ToolAttachment = z.infer<typeof toolAttachmentSchema>;

export const toolTraceSchema = z.object({
  id: z.string(),
  toolId: z.string(),
  toolName: z.string(),
  nodeId: z.string().optional(),
  agentId: z.string().optional(),
  input: z.any().optional(),
  output: z.any().optional(),
  status: z.enum(["success", "error", "skipped", "fallback_used"]),
  error: z.string().optional(),
  latencyMs: z.number().optional(),
  costEstimate: z.number().optional(),
  createdAt: z.string(),
});
export type ToolTrace = z.infer<typeof toolTraceSchema>;

export const modelBattleSchema = z.object({
  id: z.string(),
  nodeId: z.string().optional(),
  agentId: z.string().optional(),
  candidateModelIds: z.array(z.string()).default([]),
  input: z.any().optional(),
  results: z
    .array(
      z.object({
        modelId: z.string(),
        output: z.any().optional(),
        score: z.number().optional(),
        costEstimate: z.number().optional(),
        latencyMs: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
  winnerModelId: z.string().optional(),
  createdAt: z.string(),
});
export type ModelBattle = z.infer<typeof modelBattleSchema>;

/* ── Brain: agents + teams ───────────────────────────────────────────── */

/** A single agent. A node has one today; `team.agents` makes a node a crew. */
export const agentConfigSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  role: z.string().default(""),
  prompt: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
  modelSelection: modelSelectionSchema.optional(),
  toolAttachments: z.array(toolAttachmentSchema).default([]),
  /** crew-room runtime/metadata (all optional) */
  isLead: z.boolean().optional(),
  muted: z.boolean().optional(),
  /** When set, this agent is the team's controller (a visible node the Team
   *  Coordinator builds: router/judge/aggregator). Removed when the team dissolves.
   *  Members are the non-controller agents and are never rewritten. */
  isController: z.boolean().optional(),
  controllerKind: z.enum(CONTROLLER_KINDS).optional(),
  /** Optional persisted position for the agent inside the team's zoomed-in canvas. */
  position: positionSchema.optional(),
  status: z.enum(NODE_STATUS).optional(),
  summary: z.string().optional(),
  confidence: z.number().optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const teamSchema = z.object({
  strategy: z.enum(TEAM_STRATEGIES).default("sequential"),
  modelSelection: modelSelectionSchema.optional(),
  toolAttachments: z.array(toolAttachmentSchema).default([]),
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

/** Input Studio generation controls (shared by datasets + source nodes). */
export const QUALITY_TARGETS = ["realistic", "high_quality", "edge_cases", "production_like"] as const;
export type QualityTarget = (typeof QUALITY_TARGETS)[number];

export const GENERATION_STYLES = ["api_like", "user_like", "business_like", "edge_case_pack"] as const;
export type GenerationStyle = (typeof GENERATION_STYLES)[number];

/** Google Drive source binding (mode = "google_drive"). No tokens — those live encrypted,
 *  server-side, in connected_accounts. */
export const googleDriveSourceConfigSchema = z.object({
  connectedAccountId: z.string().optional(),
  pickMode: z.enum(["picked_files", "folder", "search", "manual_file_id"]).default("picked_files"),
  fileIds: z.array(z.string()).default([]),
  folderId: z.string().optional(),
  query: z.string().optional(),
  mimeTypes: z.array(z.string()).default([]),
  contentMode: z.enum(["metadata", "text", "sheet_rows", "file_link"]).default("metadata"),
  range: z.string().optional(),
  files: z
    .array(z.object({ id: z.string(), name: z.string(), mimeType: z.string().optional(), webViewLink: z.string().optional() }))
    .default([]),
});
export type GoogleDriveSourceConfig = z.infer<typeof googleDriveSourceConfigSchema>;

/** GitHub source binding (mode = github_repo / github_file / github_issues / github_pull_requests).
 *  Holds only references — never tokens. */
export const githubSourceConfigSchema = z.object({
  repositoryFullName: z.string().optional(),
  ref: z.string().optional(),
  path: z.string().optional(),
  issueState: z.enum(["open", "closed", "all"]).default("open").optional(),
});
export type GitHubSourceConfig = z.infer<typeof githubSourceConfigSchema>;

export const sourceConfigSchema = z.object({
  mode: z.enum(SOURCE_MODES).default("input_studio"),
  datasetId: z.string().optional(),
  datasetName: z.string().optional(),
  /** Google Drive binding (mode = "google_drive") */
  drive: googleDriveSourceConfigSchema.optional(),
  /** GitHub binding (mode = github_*) */
  github: githubSourceConfigSchema.optional(),
  /** dataset/source to fall back to when a live tool has no key */
  fallbackDatasetId: z.string().optional(),
  toolId: z.string().optional(),
  endpoint: z.string().optional(),
  prompt: z.string().optional(),
  rowCount: z.number().optional(),
  /** active Scenario Set tag driving which dataset this source uses */
  scenario: z.string().optional(),
  /** Previous Take binding (mode = "previous_take") */
  takeId: z.string().optional(),
  takeName: z.string().optional(),
  tableName: z.string().optional(),
  snapshot: z.boolean().optional(),
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
  modelSelection: modelSelectionSchema.optional(),
  toolAttachments: z.array(toolAttachmentSchema).default([]),
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

export const contractWarningSchema = z.object({
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]).default("warning"),
  field: z.string().optional(),
});
export type ContractWarning = z.infer<typeof contractWarningSchema>;

export const dataContractSchema = z.object({
  expects: z.array(contractFieldSchema).default([]),
  provides: z.array(contractFieldSchema).default([]),
  status: z.enum(["ok", "warning", "error", "unknown"]).default("unknown"),
  warnings: z.array(contractWarningSchema).default([]),
  notes: z.string().optional(),
  lastCheckedAt: z.string().optional(),
});
export type DataContract = z.infer<typeof dataContractSchema>;

/* ── Field mappings + scenario sets (Source Layer) ───────────────────── */

export const fieldMappingSchema = z.object({
  id: z.string(),
  fromNodeId: z.string().default(""),
  toNodeId: z.string().default(""),
  sourceField: z.string(),
  targetField: z.string(),
  transform: z
    .enum(["none", "stringify", "number", "boolean", "date", "json", "custom"])
    .default("none"),
  customTransform: z.string().optional(),
});
export type FieldMapping = z.infer<typeof fieldMappingSchema>;

/** A reusable testing scenario (e.g. "Date night in Chicago"). Drives which
 *  dataset a Source node uses via matching scenario tags. */
export const scenarioSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  tag: z.string().default(""),
  prompt: z.string().optional(),
  datasetIds: z.array(z.string()).default([]),
});
export type ScenarioSet = z.infer<typeof scenarioSetSchema>;

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
  /** Prompt 06 additions (all optional / additive) */
  category: z.string().optional(),
  mainUseCase: z.string().optional(),
  keySources: z.array(z.string()).default([]),
  keyTeams: z.array(z.string()).default([]),
  keySurfaces: z.array(z.string()).default([]),
  monetizationAngle: z.string().optional(),
  suggestedPack: z.string().optional(),
  nextBestFeature: z.string().optional(),
});
export type ProductDrop = z.infer<typeof productDropSchema>;

const RISK = z.enum(["low", "medium", "high"]);
const RISK_U = z.enum(["low", "medium", "high", "unknown"]);

export const REALITY_LABELS = [
  "rough_idea",
  "prototype_ready",
  "buildable",
  "production_shaped",
  "needs_data",
] as const;

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
  /** Prompt 06 additions (all optional / additive) */
  label: z.enum(REALITY_LABELS).optional(),
  missingData: z.array(z.string()).default([]),
  modelRisk: RISK_U.optional(),
  toolReadiness: z
    .object({ ready: z.number().default(0), missing: z.number().default(0), warnings: z.array(z.string()).default([]) })
    .optional(),
  exportReadiness: z.object({ ready: z.boolean().default(true), missingItems: z.array(z.string()).default([]) }).optional(),
  recommendedNextFeature: z.string().optional(),
  notes: z.string().optional(),
});
export type RealityMeter = z.infer<typeof realityMeterSchema>;

/* ── Remix system + product variations + brief ───────────────────────── */

export const REMIX_CATEGORIES = [
  "quality",
  "cost",
  "speed",
  "ui",
  "data",
  "tools",
  "teams",
  "export",
  "business",
  "production",
] as const;
export type RemixCategory = (typeof REMIX_CATEGORIES)[number];

export const remixActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  category: z.enum(REMIX_CATEGORIES),
  instruction: z.string().default(""),
  appliesTo: z.enum(["pipeline", "node", "team", "agent", "take", "output_table", "ui_preview"]).default("pipeline"),
});
export type RemixAction = z.infer<typeof remixActionSchema>;

export const remixChangeSchema = z.object({
  type: z.enum([
    "add_node",
    "remove_node",
    "update_node",
    "add_edge",
    "update_prompt",
    "update_model",
    "add_tool",
    "add_dataset",
    "add_ui_binding",
    "update_product_drop",
    "update_reality_meter",
  ]),
  description: z.string(),
  targetId: z.string().optional(),
  before: z.any().optional(),
  after: z.any().optional(),
});
export type RemixChange = z.infer<typeof remixChangeSchema>;

export const remixProposalSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  actionId: z.string(),
  title: z.string(),
  summary: z.string().default(""),
  changes: z.array(remixChangeSchema).default([]),
  estimatedImpact: z
    .object({
      quality: z.string().optional(),
      cost: z.string().optional(),
      speed: z.string().optional(),
      complexity: z.string().optional(),
    })
    .optional(),
  variationName: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type RemixProposal = z.infer<typeof remixProposalSchema>;

export const productVariationSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string(),
  description: z.string().default(""),
  positioning: z.string().optional(),
  targetUser: z.string().optional(),
  changes: z.array(z.string()).default([]),
  linkedTakeIds: z.array(z.string()).default([]),
  linkedRemixProposalIds: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ProductVariation = z.infer<typeof productVariationSchema>;

export const productBriefSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  title: z.string(),
  summary: z.string().default(""),
  targetUser: z.string().optional(),
  howItWorks: z.array(z.string()).default([]),
  dataNeeded: z.array(z.string()).default([]),
  aiTeams: z.array(z.string()).default([]),
  uiSurfaces: z.array(z.string()).default([]),
  missingPieces: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ProductBrief = z.infer<typeof productBriefSchema>;

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
  defaultModelSelection: modelSelectionSchema.optional(),
  toolAttachments: z.array(toolAttachmentSchema).default([]),
  modelBattles: z.array(modelBattleSchema).default([]),
  /** field-level mappings the Source Layer suggests/applies between nodes */
  fieldMappings: z.array(fieldMappingSchema).default([]),
  /** reusable testing scenarios for the Source Layer */
  scenarioSets: z.array(scenarioSetSchema).default([]),
  blueprint: productDropSchema.optional(),
  realityMeter: realityMeterSchema.optional(),
  /** Prompt 06: product brief, variations, and applied remix history (graph-jsonb backed) */
  productBrief: productBriefSchema.optional(),
  productVariations: z.array(productVariationSchema).default([]),
  remixProposals: z.array(remixProposalSchema).default([]),
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
  toolTraces: z.array(toolTraceSchema).default([]),
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
  toolTraces: z.array(toolTraceSchema).default([]),
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
  toolTraces: z.array(toolTraceSchema).default([]),
  modelBattles: z.array(modelBattleSchema).default([]),
  evalResults: z.array(evalResultSchema).default([]),
  mode: z.enum(EXECUTION_MODES).optional(),
  takeId: z.string().optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
  /** how this run was started (Task 06) — manual click vs an automation trigger */
  source: z.enum(["manual", "schedule", "webhook", "pipeline"]).optional(),
});
export type RunTrace = z.infer<typeof runTraceSchema>;

/** A Take is a saved run variation (e.g. "Conservative Scoring", "Cheaper Model"). */
export const takeSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string().default("Take"),
  description: z.string().default(""),
  /** how this take was executed */
  mode: z.enum(EXECUTION_MODES).optional(),
  status: z.enum(["success", "warning", "error"]).default("success"),
  runTraceId: z.string().optional(),
  trace: runTraceSchema.optional(),
  modelSelections: z.record(z.string()).default({}),
  /** legacy flat scores (kept for back-compat) + rich per-node eval results */
  scores: z.record(z.number()).default({}),
  evalResults: z.array(evalResultSchema).default([]),
  overallScore: z.number().optional(),
  costUsd: z.number().optional(),
  latencyMs: z.number().optional(),
  warningCount: z.number().optional(),
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
