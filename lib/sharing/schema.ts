import { z } from "zod";

/** Sharing (Task 05). A share grants a recipient (by authed email) or anyone with an unguessable
 *  link a specific level of access to one pipeline. Security is the whole point: the level lives
 *  in this record + RLS, never the UI, and a `run`-level requester never receives prompts, model
 *  config, tool creds, data sources, or intermediate traces — only the input form and results. */

export const SHARE_LEVELS = ["view", "run", "edit"] as const;
export type ShareLevel = (typeof SHARE_LEVELS)[number];

export const SHARE_LEVEL_COPY: Record<ShareLevel, { title: string; blurb: string }> = {
  view: {
    title: "View",
    blurb: "They can see the pipeline structure and its results. They cannot edit or run it.",
  },
  run: {
    title: "Run",
    blurb: "They get only the input form and the final results. They will not see your prompts, data sources, or internal steps.",
  },
  edit: {
    title: "Edit",
    blurb: "Full collaborator. They can change everything.",
  },
};

export const pipelineShareSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  ownerId: z.string().nullable().default(null),
  level: z.enum(SHARE_LEVELS).default("run"),
  recipients: z.array(z.object({ email: z.string() })).default([]),
  linkEnabled: z.boolean().default(false),
  linkToken: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type PipelineShare = z.infer<typeof pipelineShareSchema>;
