import { z } from "zod";
import {
  GENERATION_STYLES,
  QUALITY_TARGETS,
  SOURCE_MODES,
  tableColumnSchema,
} from "@/lib/pipeline/schema";

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
  /** Input Studio generation metadata */
  qualityTarget: z.enum(QUALITY_TARGETS).optional(),
  generationStyle: z.enum(GENERATION_STYLES).optional(),
  /** scenario tags for the Scenario Set selector */
  scenarioTags: z.array(z.string()).default([]),
  /** fields the dataset is expected to provide (for contracts) */
  requiredFields: z.array(z.string()).default([]),
  /** node this dataset is currently bound to, if any */
  connectedNodeId: z.string().optional(),
  connectedPipelines: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type Dataset = z.infer<typeof datasetSchema>;
