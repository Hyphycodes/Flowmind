import { z } from "zod";

/** Evaluator / Judge dimensions. Includes generic quality dims + Jarvis-style custom dims. */
export const EVAL_DIMENSIONS = [
  // generic
  "correctness",
  "structure",
  "style",
  "relevance",
  "data_completeness",
  "confidence",
  "cost_speed",
  "policy",
  "user_fit",
  // Jarvis-style custom
  "taste_match",
  "vibe_match",
  "corny_risk",
  "actionability",
  "location_fit",
  "budget_fit",
  "freshness",
  "luxury_level",
] as const;
export type EvalDimension = (typeof EVAL_DIMENSIONS)[number];

export const evalScoreSchema = z.object({
  dimension: z.string(),
  score: z.number(), // 0–100
  notes: z.string().optional(),
});
export type EvalScore = z.infer<typeof evalScoreSchema>;

export const evalResultSchema = z.object({
  nodeId: z.string(),
  overall: z.number().default(0),
  verdict: z.enum(["pass", "warn", "fail"]).default("pass"),
  scores: z.array(evalScoreSchema).default([]),
  summary: z.string().optional(),
});
export type EvalResult = z.infer<typeof evalResultSchema>;
