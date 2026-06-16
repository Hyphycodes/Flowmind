import { z } from "zod";

/** Living Library (Task 04) — reusable assets saved from your work: a node, just a prompt, a tool
 *  config, or a reference to a dataset. The more you save, the more Flowmind becomes *yours*.
 *  Mirrors the dataset persistence pattern exactly (Zod schema + list/save/delete + RLS). */

export const LIBRARY_KINDS = ["node", "prompt", "tool", "dataset_ref"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const libraryAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(LIBRARY_KINDS),
  name: z.string().default("Untitled"),
  description: z.string().optional(),
  /** node → a PipelineNode; prompt → a string; tool → tool config; dataset_ref → a dataset id */
  payload: z.any(),
  tags: z.array(z.string()).default([]),
  usageCount: z.number().default(0),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type LibraryAsset = z.infer<typeof libraryAssetSchema>;

export const LIBRARY_KIND_LABEL: Record<LibraryKind, string> = {
  node: "Nodes",
  prompt: "Prompts",
  tool: "Tools",
  dataset_ref: "Datasets",
};
