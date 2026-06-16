import { newId } from "@/lib/pipeline/validate";
import { getModel } from "@/lib/models/providers";
import type { EditChange } from "@/lib/pipeline/editDiff";
import {
  builderPreferencesSchema,
  type BuilderPreferences,
  type PreferenceKind,
} from "./schema";

/** Learn builder patterns from real, repeated actions (Task 03b). We observe what changes a person
 *  actually applies — adding a critic, routing a node to a cheap model, parallelizing — and
 *  strengthen the matching pattern. Observed only; weights decay so stale habits fade. */

const CRITIC = /(critic|review|evaluat|judge|fact.?check|qa|verify)/i;

function isCheapModel(modelId?: string): boolean {
  if (!modelId) return false;
  const m = getModel(modelId);
  if (!m) return /haiku|flash|mini|nano|small|groq|llama/i.test(modelId);
  return m.costTier === "cheap" || m.speedTier === "fast" || m.speedTier === "very_fast";
}

type Observation = { kind: PreferenceKind; statement: string; model?: string };

function observationsFor(changes: EditChange[]): Observation[] {
  const obs: Observation[] = [];
  for (const ch of changes) {
    const d = ch.diff;
    // Added a critic / evaluator
    for (const n of d.add_nodes) {
      const text = `${n.type ?? ""} ${n.title ?? ""} ${n.role ?? ""} ${n.prompt ?? ""}`;
      if (n.type === "evaluator" || CRITIC.test(text)) {
        obs.push({ kind: "critic_after_scorer", statement: "Add a critic / evaluator to review output before it ships." });
      }
      const strat = (n.team as { strategy?: string } | undefined)?.strategy;
      if (strat === "parallel") {
        obs.push({ kind: "parallelize_independent", statement: "Run independent steps in parallel rather than in sequence." });
      }
      if (/checkpoint|approval/i.test(text)) {
        obs.push({ kind: "add_checkpoint", statement: "Add a human review checkpoint before the output ships." });
      }
    }
    // Routed a node to a cheap model (extraction / light work)
    for (const m of d.modify_nodes) {
      const model = (m as { model?: string }).model;
      if (model && isCheapModel(model)) {
        obs.push({ kind: "fast_model_extraction", statement: "Prefer the fast / cheap model for extraction and light transforms.", model });
      }
    }
  }
  return obs;
}

/** Fold a batch of applied changes into preferences: reinforce matching observed patterns, set
 *  model defaults, and lightly decay patterns that weren't reinforced. Returns updated prefs. */
export function learnFromAppliedChanges(prefs: BuilderPreferences, changes: EditChange[]): BuilderPreferences {
  const obs = observationsFor(changes);
  if (obs.length === 0) return prefs;

  const now = new Date().toISOString();
  const patterns = prefs.patterns.map((p) => ({ ...p }));
  const reinforced = new Set<string>();
  const defaults = { ...prefs.defaults };

  for (const o of obs) {
    if (o.kind === "fast_model_extraction" && o.model) defaults.lightModelPref = o.model;
    const existing = patterns.find((p) => p.kind === o.kind && p.source === "observed");
    if (existing) {
      existing.weight = Math.min(existing.weight + 1, 12);
      existing.lastSeenAt = now;
      existing.statement = o.statement;
      reinforced.add(existing.id);
    } else {
      const id = newId("pref");
      patterns.push({ id, kind: o.kind, statement: o.statement, source: "observed", weight: 1, lastSeenAt: now });
      reinforced.add(id);
    }
  }

  // Decay un-reinforced observed patterns; drop the truly stale. Explicit patterns never decay.
  const decayed = patterns
    .map((p) => (p.source === "observed" && !reinforced.has(p.id) ? { ...p, weight: p.weight * 0.9 } : p))
    .filter((p) => p.source === "explicit" || p.weight >= 0.5);

  return builderPreferencesSchema.parse({ ...prefs, patterns: decayed, defaults, updatedAt: now });
}
