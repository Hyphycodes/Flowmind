import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel, hasAnthropicKey } from "@/lib/ai/anthropic";
import { newId } from "@/lib/pipeline/validate";
import type { GenerationStyle, QualityTarget, TableColumn } from "@/lib/pipeline/schema";
import { datasetSchema, type Dataset } from "./schema";
import { inferDatasetSchema, scoreDatasetQuality } from "./quality";

const COLUMN_TYPES = ["text", "number", "currency", "percent", "badge", "date"] as const;
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function asColType(t: unknown): TableColumn["type"] {
  return (COLUMN_TYPES as readonly string[]).includes(t as string) ? (t as TableColumn["type"]) : "text";
}

const genSchema = z.object({
  columns: z
    .array(z.object({ key: z.string(), label: z.string(), type: z.enum(COLUMN_TYPES).default("text") }))
    .min(1),
  rows: z.array(z.record(cell)).default([]),
});

export type InputStudioRequest = {
  name?: string;
  prompt: string;
  columns?: { key: string; label: string; type?: string }[];
  rowCount?: number;
  qualityTarget?: QualityTarget;
  generationStyle?: GenerationStyle;
  scenarioTags?: string[];
  requiredFields?: string[];
  examples?: Record<string, unknown>[];
  /** when extending, the rows already in the dataset (appended to) */
  existingRows?: Record<string, unknown>[];
  datasetId?: string;
};

const QUALITY_GUIDANCE: Record<QualityTarget, string> = {
  realistic: "Realistic, believable rows a real user would recognize.",
  high_quality: "High-quality, polished rows with rich, specific detail in every field.",
  edge_cases: "Include tricky edge cases: boundary values, unusual but valid combinations, near-duplicates.",
  production_like: "Production-like volume and variety; consistent types, no empty cells, stable formatting.",
};

const STYLE_GUIDANCE: Record<GenerationStyle, string> = {
  api_like: "Shape rows like a real API response (flat fields, ids, enums, ISO dates).",
  user_like: "Shape rows like user-entered data (natural phrasing, some variance).",
  business_like: "Shape rows like an internal business dataset (clean, tabular, reportable).",
  edge_case_pack: "Bias toward an edge-case pack: missing-but-valid, extremes, rare categories.",
};

function buildDataset(
  req: InputStudioRequest,
  columns: TableColumn[],
  rows: Record<string, unknown>[],
): Dataset {
  const schema = columns.length ? columns : inferDatasetSchema(rows);
  const requiredFields = req.requiredFields ?? [];
  return datasetSchema.parse({
    id: req.datasetId ?? newId("ds"),
    name: req.name ?? "Generated dataset",
    description: req.prompt.slice(0, 200),
    mode: "input_studio",
    schema,
    rows,
    sourcePrompt: req.prompt,
    qualityTarget: req.qualityTarget,
    generationStyle: req.generationStyle,
    scenarioTags: req.scenarioTags ?? [],
    requiredFields,
    version: 1,
    qualityScore: scoreDatasetQuality(schema, rows, requiredFields),
  });
}

/** Generate a reusable, high-quality seed dataset with real Claude (graceful fallback). */
export async function generateInputDataset(req: InputStudioRequest): Promise<Dataset> {
  const rowCount = Math.min(Math.max(req.rowCount ?? 20, 1), 60);
  const existing = req.existingRows ?? [];

  let columns: TableColumn[] =
    req.columns?.map((c) => ({ key: c.key, label: c.label, type: asColType(c.type) })) ?? [];
  let rows: Record<string, unknown>[] = [];

  if (hasAnthropicKey()) {
    const { object } = await generateObject({
      model: anthropicModel(),
      schema: genSchema,
      system:
        "You generate realistic, specific seed datasets for testing AI pipelines (Flowmind Input Studio). " +
        "Never lorem ipsum, never placeholder junk. Numbers as plain numbers. Rows must use the column keys. " +
        (req.qualityTarget ? QUALITY_GUIDANCE[req.qualityTarget] + " " : "") +
        (req.generationStyle ? STYLE_GUIDANCE[req.generationStyle] : ""),
      prompt: [
        `Dataset request: ${req.prompt}`,
        req.scenarioTags?.length ? `Scenario: ${req.scenarioTags.join(", ")}.` : "",
        `Produce ~${rowCount} rows.`,
        req.requiredFields?.length ? `Always include these fields: ${req.requiredFields.join(", ")}.` : "",
        req.columns?.length
          ? `Use exactly these columns: ${req.columns.map((c) => `${c.key} (${c.label})`).join(", ")}.`
          : "Infer a sensible set of columns from the request.",
        existing.length
          ? `These rows already exist — generate NEW, non-duplicate rows in the same shape:\n${JSON.stringify(existing.slice(0, 8))}`
          : "",
        req.examples?.length ? `Example rows to match in spirit:\n${JSON.stringify(req.examples.slice(0, 5))}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.6,
      maxRetries: 1,
    });
    columns = object.columns.map((c) => ({
      key: c.key,
      label: c.label || c.key,
      type: asColType(c.type),
    }));
    rows = [...existing, ...(object.rows ?? [])].slice(0, existing.length + rowCount).map((r) => ({ ...r }));
  } else {
    if (columns.length === 0) columns = [{ key: "item", label: "Item", type: "text" }];
    const generated = Array.from({ length: Math.min(rowCount, 12) }, (_, i) =>
      Object.fromEntries(columns.map((c) => [c.key, `${c.label} ${existing.length + i + 1}`])),
    );
    rows = [...existing, ...generated];
  }

  return buildDataset(req, columns, rows);
}
