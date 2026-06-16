import { z } from "zod";

/** Builder preferences (Task 03b) — the quiet moat. Flowmind learns *your* patterns ("you always
 *  add a critic after scorers", "you prefer the fast model for extraction") from repeated real
 *  actions, and nudges generation/edits toward how you already build. Observed, never assumed;
 *  always user-viewable and deletable. Explicit preferences outrank observed ones. */

export const PREFERENCE_KINDS = [
  "critic_after_scorer",
  "fast_model_extraction",
  "parallelize_independent",
  "add_checkpoint",
  "strong_model_synthesis",
  "other",
] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

export const preferencePatternSchema = z.object({
  id: z.string(),
  kind: z.enum(PREFERENCE_KINDS).default("other"),
  statement: z.string(),
  source: z.enum(["observed", "explicit"]).default("observed"),
  weight: z.number().default(1),
  lastSeenAt: z.string().default(() => new Date().toISOString()),
});
export type PreferencePattern = z.infer<typeof preferencePatternSchema>;

export const builderDefaultsSchema = z.object({
  lightModelPref: z.string().optional(),
  heavyModelPref: z.string().optional(),
  defaultEffort: z.enum(["tight", "balanced", "deep"]).optional(),
});
export type BuilderDefaults = z.infer<typeof builderDefaultsSchema>;

export const builderPreferencesSchema = z.object({
  id: z.string().default("default"),
  scope: z.enum(["user", "workspace"]).default("user"),
  patterns: z.array(preferencePatternSchema).default([]),
  defaults: builderDefaultsSchema.default({}),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type BuilderPreferences = z.infer<typeof builderPreferencesSchema>;

/** The known id for the single demo/user preferences record (auth scopes this per user later). */
export const PREFERENCES_ID = "default";

export function emptyPreferences(): BuilderPreferences {
  return builderPreferencesSchema.parse({ id: PREFERENCES_ID, patterns: [], defaults: {} });
}

/** Patterns strong enough to act on: explicit always count; observed need repetition (weight >= 2). */
export function activePatterns(p: BuilderPreferences): PreferencePattern[] {
  return p.patterns
    .filter((x) => x.source === "explicit" || x.weight >= 2)
    .sort((a, b) => (a.source === b.source ? b.weight - a.weight : a.source === "explicit" ? -1 : 1));
}

/** Soft-guidance block injected (server-side) into generate/edit prompts. Nudges, never overrides. */
export function preferencesToPromptBlock(p: BuilderPreferences | null | undefined): string | null {
  if (!p) return null;
  const active = activePatterns(p);
  const lines: string[] = [];
  for (const pat of active.slice(0, 8)) lines.push(`- ${pat.statement}`);
  const d = p.defaults;
  const defaults: string[] = [];
  if (d.lightModelPref) defaults.push(`light/extraction work → ${d.lightModelPref}`);
  if (d.heavyModelPref) defaults.push(`hard reasoning/synthesis → ${d.heavyModelPref}`);
  if (d.defaultEffort) defaults.push(`default effort → ${d.defaultEffort}`);
  if (lines.length === 0 && defaults.length === 0) return null;
  return [
    "This builder tends to build in a particular way. Treat the following as soft guidance — nudge toward it,",
    "but never override an explicit request:",
    ...lines,
    defaults.length ? `Preferred defaults: ${defaults.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
