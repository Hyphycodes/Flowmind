import { z } from "zod";

/**
 * Import feature (Prompt 21) — the framework-agnostic Intermediate Representation.
 *
 * Everything the static analyzer detects extracts INTO this IR, which then maps onto Flowmind's
 * graph model (`toPipeline.ts`). The IR is deliberately conservative: every detected element carries
 * a `confidence` (0–1) and a `status`; anything we can't substantiate is marked `"unknown"` and
 * surfaced for human review rather than given a confident-but-wrong label.
 *
 * Honest scope (v1): static detection of LLM calls in the JS/TS + Python AI-app ecosystem
 * (Anthropic SDK, OpenAI SDK, Vercel AI SDK, LangChain, CrewAI) plus the hand-rolled case (raw SDK
 * calls wired together). It does NOT reliably resolve dynamic dispatch (registries / DI), prompts
 * assembled at runtime, or cross-file data flow beyond simple imports — those degrade to `unknown`
 * and are reported in `skipped` / `notes`.
 */

export const importFrameworks = [
  "anthropic",
  "openai",
  "vercel_ai",
  "langchain",
  "crewai",
  "unknown",
] as const;
export type ImportFramework = (typeof importFrameworks)[number];

export type DetectionStatus = "detected" | "unknown";

export const sourceRefSchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const importedAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  /** Model id as written in the source (e.g. "claude-sonnet-4-6", "gpt-4o"), if found. */
  model: z.string().optional(),
  /** The system/user prompt text found attached to this call, if any. */
  prompt: z.string().optional(),
  framework: z.enum(importFrameworks),
  /** What kind of node this maps to on the canvas. */
  kind: z.enum(["agent", "tool", "evaluator"]).default("agent"),
  confidence: z.number().min(0).max(1),
  status: z.enum(["detected", "unknown"]),
  sourceRef: sourceRefSchema,
  /** One line citing WHY we think this is an agent (the matched evidence), for review. */
  evidence: z.string(),
});
export type ImportedAgent = z.infer<typeof importedAgentSchema>;

export const importedFlowSchema = z.object({
  from: z.string(),
  to: z.string(),
  confidence: z.number().min(0).max(1),
  /** How the handoff was inferred (e.g. "variable `draft` reused", "sequential order"). */
  via: z.string(),
});
export type ImportedFlow = z.infer<typeof importedFlowSchema>;

export const importedTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  strategy: z.enum(["sequential", "parallel", "router", "debate", "vote", "single"]).default("sequential"),
  memberIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});
export type ImportedTeam = z.infer<typeof importedTeamSchema>;

export const importIRSchema = z.object({
  agents: z.array(importedAgentSchema).default([]),
  flows: z.array(importedFlowSchema).default([]),
  teams: z.array(importedTeamSchema).default([]),
  /** Files scanned vs. skipped (binary/vendor/too-big), for the honest report. */
  scannedFiles: z.array(z.string()).default([]),
  skipped: z.array(z.object({ file: z.string(), reason: z.string() })).default([]),
  /** Frameworks detected across the codebase. */
  frameworks: z.array(z.enum(importFrameworks)).default([]),
  notes: z.array(z.string()).default([]),
});
export type ImportIR = z.infer<typeof importIRSchema>;

/** The extraction report shown to the user before they accept the import. */
export type ImportReport = {
  detectedAgents: number;
  unknownAgents: number;
  flows: number;
  teams: number;
  frameworks: ImportFramework[];
  scanned: number;
  skipped: number;
  /** Overall honesty signal: did we find a real AI system, a partial one, or nothing? */
  verdict: "ai_system" | "partial" | "none";
  summary: string;
};
