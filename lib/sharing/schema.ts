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

/** Task 05b — pricing attached to a `run` share. per_run = pay per execution; subscription =
 *  recurring access. Stored on the share. Server-enforced at the run path (never the UI). */
export const PRICING_MODES = ["free", "per_run", "subscription"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const sharePricingSchema = z.object({
  mode: z.enum(PRICING_MODES).default("free"),
  amountUsd: z.number().default(0),
  currency: z.string().default("usd"),
  /** owner opt-in to capture submitted input *values* (not just keys), with a notice on the app */
  captureInputValues: z.boolean().default(false),
});
export type SharePricing = z.infer<typeof sharePricingSchema>;

export const pipelineShareSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  ownerId: z.string().nullable().default(null),
  level: z.enum(SHARE_LEVELS).default("run"),
  recipients: z.array(z.object({ email: z.string() })).default([]),
  linkEnabled: z.boolean().default(false),
  linkToken: z.string().optional(),
  pricing: sharePricingSchema.optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type PipelineShare = z.infer<typeof pipelineShareSchema>;

/** A recorded Run-App execution (analytics). requesterRef is a hash — never raw PII. */
export const shareRunSchema = z.object({
  id: z.string(),
  shareId: z.string(),
  requesterRef: z.string().nullish(),
  status: z.string(),
  durationMs: z.number().nullish(),
  costUsd: z.number().nullish(),
  inputKeys: z.array(z.string()).default([]),
  runId: z.string().nullish(),
  createdAt: z.string(),
});
export type ShareRun = z.infer<typeof shareRunSchema>;

/** An entitlement to run a priced share — created on payment, checked server-side each run. */
export const shareEntitlementSchema = z.object({
  id: z.string(),
  shareId: z.string(),
  requesterRef: z.string(),
  kind: z.enum(["per_run", "subscription"]),
  runsRemaining: z.number().nullish(),
  activeUntil: z.string().nullish(),
  createdAt: z.string(),
});
export type ShareEntitlement = z.infer<typeof shareEntitlementSchema>;
