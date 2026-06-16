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
  /** Task 06b — auto-retry config (bounded backoff) */
  retry: z.object({ maxAttempts: z.number().default(3), baseDelayMinutes: z.number().default(1) }).optional(),
  /** Task 06b — failure/recovery alerts (outbound webhook; email config-gated) */
  alerts: z
    .object({
      webhookUrl: z.string().optional(),
      email: z.string().optional(),
      events: z.array(z.enum(["failure", "recovery", "every_run"])).default(["failure", "recovery"]),
    })
    .optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  lastFiredAt: z.string().optional(),
  lastStatus: z.enum(["success", "error", "skipped"]).optional(),
  /** Task 06b runtime state (server-managed) */
  retryAttempt: z.number().optional(),
  nextRetryAt: z.string().nullish(),
  lastError: z.string().nullish(),
  alertedFailure: z.boolean().optional(),
});
export type Trigger = z.infer<typeof triggerSchema>;

/** Max depth for pipeline→pipeline chains so A→B→A can never loop forever. */
export const MAX_TRIGGER_CHAIN_DEPTH = 4;

/** Bounded retry backoff in minutes (Task 06b): ~1m, 5m, 15m, then stop. */
export const RETRY_BACKOFF_MINUTES = [1, 5, 15];

/** A per-firing record for the trigger health view. */
export const triggerRunSchema = z.object({
  id: z.string(),
  triggerId: z.string(),
  runId: z.string().nullish(),
  status: z.string(),
  attempt: z.number().default(1),
  durationMs: z.number().nullish(),
  costUsd: z.number().nullish(),
  error: z.string().nullish(),
  startedAt: z.string().nullish(),
  createdAt: z.string(),
});
export type TriggerRun = z.infer<typeof triggerRunSchema>;
