import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel } from "@/lib/ai/anthropic";
import {
  ACCENTS,
  type FinalOutput,
  type OutputTable,
  type PipelineNode,
  type TableColumn,
} from "./schema";

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

export type ExecuteContext = {
  pipelineName: string;
  mockInputs: Record<string, string>;
  upstream: Record<string, OutputTable>;
};

export type ExecuteResult = {
  summary: string;
  tables: OutputTable[];
  final?: FinalOutput;
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

/** Execute a single node with real Claude, producing structured table data. */
export async function executeNode(node: PipelineNode, ctx: ExecuteContext): Promise<ExecuteResult> {
  const model = anthropicModel(node.model);
  const expected = node.outputs.length ? node.outputs : [node.id];
  const isOutput = node.type === "output";
  const schema = isOutput ? outputNodeResultSchema : nodeResultSchema;

  const upstreamData: Record<string, unknown> = {};
  for (const [key, table] of Object.entries(ctx.upstream)) {
    upstreamData[key] = table.rows;
  }

  const system =
    "You are one node inside Flowmind, a visual AI agent pipeline. Produce realistic, specific, decision-useful structured data — never placeholders or lorem ipsum. " +
    "Numbers must be plain numbers (e.g. 285000, not \"$285,000\") so the UI can format them. Keep each table tight (1–8 rows). " +
    "Return a table for every requested output key, using those exact key names.";

  const prompt = [
    `Pipeline: ${ctx.pipelineName}`,
    `Node: ${node.title}${node.role ? ` — ${node.role}` : ""} (type: ${node.type})`,
    `Task: ${node.prompt || node.description || node.title}`,
    `Pipeline inputs: ${JSON.stringify(ctx.mockInputs)}`,
    `Upstream data: ${JSON.stringify(upstreamData).slice(0, 7000)}`,
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
