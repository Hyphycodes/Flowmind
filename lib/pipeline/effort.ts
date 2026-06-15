/** Architect effort dial — sizes how big a pipeline a description generates.
 *  Kept dependency-free (no AI SDK / server imports) so client components like the
 *  CommandBar can import the levels + labels safely. The Architect engine
 *  (`architect.ts`) consumes the type; the prompt sizing lives there. */

export const EFFORT_LEVELS = ["tight", "balanced", "deep"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export function isEffort(x: unknown): x is EffortLevel {
  return typeof x === "string" && (EFFORT_LEVELS as readonly string[]).includes(x);
}

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  tight: "Tight",
  balanced: "Balanced",
  deep: "Deep",
};

/** Short hint shown on hover — the node-count guidance the Architect follows. */
export const EFFORT_HINTS: Record<EffortLevel, string> = {
  tight: "One clean chain · ~3–6 nodes",
  balanced: "A few nodes + small teams · ~6–12 nodes",
  deep: "Rich structure: teams, debate & vote · up to ~30 agents",
};
