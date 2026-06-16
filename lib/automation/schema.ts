import { z } from "zod";

/** Triggers (Task 06) — pipelines that run themselves. A trigger fires the headless run core
 *  without a browser tab open: on a schedule, from a webhook, or after another pipeline completes. */

export const TRIGGER_TYPES = ["schedule", "webhook", "pipeline"] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const triggerSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  ownerId: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
  type: z.enum(TRIGGER_TYPES),
  name: z.string().default(""),
  /** type=schedule */
  schedule: z.object({ cron: z.string(), timezone: z.string().default("UTC") }).optional(),
  /** type=webhook */
  webhook: z.object({ token: z.string(), inputMapping: z.record(z.string()).default({}) }).optional(),
  /** type=pipeline — run after this upstream pipeline completes successfully */
  upstreamPipelineId: z.string().optional(),
  defaultInputs: z.record(z.unknown()).default({}),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  lastFiredAt: z.string().optional(),
  lastStatus: z.enum(["success", "error", "skipped"]).optional(),
});
export type Trigger = z.infer<typeof triggerSchema>;

/** Max depth for pipeline→pipeline chains so A→B→A can never loop forever. */
export const MAX_TRIGGER_CHAIN_DEPTH = 4;
