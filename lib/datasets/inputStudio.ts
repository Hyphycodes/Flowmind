import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel, hasAnthropicKey } from "@/lib/ai/anthropic";
import { newId } from "@/lib/pipeline/validate";
import { datasetSchema, type Dataset } from "./schema";

const COLUMN_TYPES = ["text", "number", "currency", "percent", "badge", "date"] as const;
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

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
};

function quality(columns: { key: string }[], rows: Record<string, unknown>[]): number {
  if (!rows.length || !columns.length) return 0;
  let filled = 0;
  let total = 0;
  for (const r of rows)
    for (const c of columns) {
      total += 1;
      const v = r[c.key];
      if (v !== null && v !== undefined && v !== "") filled += 1;
    }
  return total ? Math.round((filled / total) * 100) : 0;
}

/** Generate a reusable, high-quality seed dataset with real Claude (graceful fallback). */
export async function generateInputDataset(req: InputStudioRequest): Promise<Dataset> {
  const rowCount = Math.min(Math.max(req.rowCount ?? 20, 1), 60);

  let columns: { key: string; label: string; type: any }[] =
    req.columns?.map((c) => ({ key: c.key, label: c.label, type: (c.type as any) ?? "text" })) ?? [];
  let rows: Record<string, unknown>[] = [];

  if (hasAnthropicKey()) {
    const { object } = await generateObject({
      model: anthropicModel(),
      schema: genSchema,
      system:
        "You generate realistic, specific seed datasets for testing AI pipelines (Input Studio). " +
        "No lorem ipsum. Numbers as plain numbers. Rows must use the column keys.",
      prompt: [
        `Dataset request: ${req.prompt}`,
        `Produce ~${rowCount} rows.`,
        req.columns?.length
          ? `Use exactly these columns: ${req.columns.map((c) => `${c.key} (${c.label})`).join(", ")}.`
          : "Infer a sensible set of columns from the request.",
      ].join("\n"),
      temperature: 0.6,
      maxRetries: 1,
    });
    columns = object.columns.map((c) => ({
      key: c.key,
      label: c.label || c.key,
      type: (COLUMN_TYPES as readonly string[]).includes(c.type) ? c.type : "text",
    }));
    rows = (object.rows ?? []).slice(0, rowCount).map((r) => ({ ...r }));
  } else {
    if (columns.length === 0) columns = [{ key: "item", label: "Item", type: "text" }];
    rows = Array.from({ length: Math.min(rowCount, 12) }, (_, i) =>
      Object.fromEntries(columns.map((c) => [c.key, `${c.label} ${i + 1}`])),
    );
  }

  return datasetSchema.parse({
    id: newId("ds"),
    name: req.name ?? "Generated dataset",
    description: req.prompt.slice(0, 200),
    mode: "input_studio",
    schema: columns,
    rows,
    sourcePrompt: req.prompt,
    version: 1,
    qualityScore: quality(columns, rows),
  });
}
