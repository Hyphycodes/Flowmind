import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel } from "@/lib/ai/anthropic";
import { ACCENTS, COMPONENT_TYPES, NODE_TYPES, type Pipeline } from "./schema";
import { repairPipeline } from "./validate";

const genSchema = z.object({
  name: z.string(),
  description: z.string(),
  nodes: z
    .array(
      z.object({
        id: z.string().describe("kebab-case id"),
        type: z.enum(NODE_TYPES),
        title: z.string(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        role: z.string().optional(),
        prompt: z.string().describe("the instruction this agent runs"),
        color: z.enum(ACCENTS).optional(),
        inputs: z.array(z.string()).default([]).describe("upstream table keys it consumes"),
        outputs: z.array(z.string()).default([]).describe("table keys it emits"),
      }),
    )
    .min(3)
    .max(8),
  edges: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        dataKey: z.string().optional(),
        label: z.string().optional(),
      }),
    )
    .default([]),
  mockInputs: z
    .array(z.object({ key: z.string(), label: z.string(), value: z.string().default("") }))
    .default([]),
  outputTables: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        sourceNodeId: z.string().optional(),
        description: z.string().optional(),
        columns: z
          .array(z.object({ key: z.string(), label: z.string(), type: z.string().optional() }))
          .default([]),
      }),
    )
    .default([]),
  uiBindings: z
    .array(
      z.object({
        tableId: z.string(),
        componentType: z.enum(COMPONENT_TYPES),
        title: z.string().optional(),
        fields: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

/** Generate a validated Pipeline from a natural-language description (real Claude). */
export async function generatePipeline(description: string): Promise<Pipeline> {
  const model = anthropicModel();

  const system =
    "You are a senior AI systems architect. Design a clean, runnable agent pipeline for the user's described system. " +
    "Rules: 4–8 nodes; exactly one `input` node first and one `output` node last; intermediate nodes are agent/tool/transformer/evaluator. " +
    "Give every node a crisp title, a one-line description, and a concrete `prompt` it will run. " +
    "Wire edges so each node's `inputs` are produced by upstream nodes' `outputs` (table keys, snake_case). " +
    "Define an outputTable for each meaningful output key with sensible columns, and 1–3 uiBindings mapping tables to preview components. " +
    "Pick a distinct color per node from the palette. Be specific to the domain — no placeholders.";

  const { object } = await generateObject({
    model,
    schema: genSchema,
    system,
    prompt: `Design the pipeline for: ${description}`,
    temperature: 0.4,
    maxRetries: 1,
  });

  // attach ids to bindings so they satisfy the canonical schema
  const withIds = {
    ...object,
    uiBindings: (object.uiBindings ?? []).map((b, i) => ({ ...b, id: `b-${i}-${b.tableId}` })),
  };

  return repairPipeline(withIds, { description, name: object.name });
}
