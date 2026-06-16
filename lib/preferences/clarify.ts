/** Ask-or-build gate (Task 03b). A cheap, dependency-free heuristic on description specificity:
 *  only genuinely underspecified requests trigger a single clarifying question — normal requests
 *  pass straight through. There is always a "just build it" escape on the client. */

const ACTION =
  /(analyz|recommend|scor|triage|summar|generat|classif|review|monitor|track|qualif|extract|plan|research|writ|draft|rout|detect|predict|match|rank|compar|find|search|moderat|translat|automat|repurpos|enrich|valid|audit|forecast|optimiz|answer|reply|respond|schedul|sort|filter|qualify|convert|score)/;

const ONLY_GENERIC =
  /^(a|an|the|build|make|create|some|my|me)?\s*(ai|llm|gpt|smart|simple)?\s*(app|tool|bot|chatbot|assistant|system|agent|thing|platform|dashboard|product|engine|pipeline|workflow|something|anything)s?\.?$/;

export type AmbiguityResult = { ambiguous: boolean; question?: string; options?: string[] };

export function detectAmbiguity(description: string): AmbiguityResult {
  const d = description.trim().toLowerCase();
  const words = d.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { ambiguous: false };
  // A reasonably detailed request, or one with a clear action verb, is buildable as-is.
  if (words.length >= 5) return { ambiguous: false };
  if (ACTION.test(d)) return { ambiguous: false };
  if (ONLY_GENERIC.test(d) || words.length === 1) {
    return {
      ambiguous: true,
      question: "Quick one — what should it actually do? Pick a direction or tell me in a sentence.",
      options: ["Recommend things", "Analyze & score", "Summarize & draft", "Triage & route", "Answer questions"],
    };
  }
  return { ambiguous: false };
}
