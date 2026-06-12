import { z } from "zod";
import { SOURCE_MODES, tableColumnSchema } from "@/lib/pipeline/schema";

/** A reusable, versioned input dataset — the Input Studio / Dataset Library data model.
 *  Not "mock mode": deliberate, high-quality seed data reusable across pipelines. */
export const datasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  mode: z.enum(SOURCE_MODES).default("input_studio"),
  schema: z.array(tableColumnSchema).default([]),
  rows: z.array(z.record(z.any())).default([]),
  sourcePrompt: z.string().optional(),
  version: z.number().default(1),
  qualityScore: z.number().optional(),
  connectedPipelines: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type Dataset = z.infer<typeof datasetSchema>;
