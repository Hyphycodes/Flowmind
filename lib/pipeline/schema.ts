import { z } from "zod";

/** Canonical Flowmind schemas. Everything that renders, runs, persists, or exports
 *  flows through these. Keep this the single source of truth. */

export const NODE_TYPES = [
  "input",
  "agent",
  "tool",
  "transformer",
  "evaluator",
  "output",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

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

export const TEAM_STRATEGIES = [
  "sequential",
  "parallel",
  "router",
  "debate",
  "vote",
] as const;

export const COMPONENT_TYPES = [
  "metricCards",
  "recordList",
  "summaryCard",
  "detailPanel",
  "jsonViewer",
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const positionSchema = z.object({ x: z.number(), y: z.number() });

/** A single agent. A node has one today; `team.agents` makes a node a crew later. */
export const agentConfigSchema = z.object({
  id: z.string(),
  role: z.string().default(""),
  prompt: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const teamSchema = z.object({
  strategy: z.enum(TEAM_STRATEGIES).default("sequential"),
  agents: z.array(agentConfigSchema).default([]),
});
export type Team = z.infer<typeof teamSchema>;

export const pipelineNodeSchema = z.object({
  id: z.string(),
  type: z.enum(NODE_TYPES),
  title: z.string(),
  subtitle: z.string().default(""),
  description: z.string().default(""),
  role: z.string().default(""),
  prompt: z.string().default(""),
  model: z.string().default("claude-sonnet-4-6"),
  color: z.enum(ACCENTS).optional(),
  position: positionSchema.default({ x: 0, y: 0 }),
  /** keys this node consumes / emits (drive the input/output chips + tables) */
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  status: z.enum(NODE_STATUS).default("idle"),
  /** Forward-compat: when present, this node is a team of agents. */
  team: teamSchema.optional(),
});
export type PipelineNode = z.infer<typeof pipelineNodeSchema>;

export const pipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
  label: z.string().optional(),
  dataKey: z.string().optional(),
  animated: z.boolean().default(false),
});
export type PipelineEdge = z.infer<typeof pipelineEdgeSchema>;

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
});
export type OutputTable = z.infer<typeof outputTableSchema>;

export const uiBindingSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  componentType: z.enum(COMPONENT_TYPES),
  title: z.string().default(""),
  position: z.number().default(0),
  fields: z.array(z.string()).default([]),
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
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

export const runStepSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  status: z.enum(NODE_STATUS),
  input: z.any().optional(),
  output: z.any().optional(),
  summary: z.string().optional(),
  durationMs: z.number().default(0),
  startedAt: z.string().optional(),
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
});
export type RunTrace = z.infer<typeof runTraceSchema>;

/** Streamed run event (NDJSON line from /api/run). */
export type RunEvent =
  | { kind: "run-start"; runId: string; order: string[] }
  | { kind: "node-start"; nodeId: string }
  | {
      kind: "node-done";
      nodeId: string;
      status: NodeStatus;
      summary?: string;
      output?: unknown;
      durationMs: number;
      tables: OutputTable[];
    }
  | { kind: "run-done"; status: "success" | "error"; finalOutput?: FinalOutput; error?: string };
