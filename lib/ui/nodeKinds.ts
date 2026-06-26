import type { NodeType } from "@/lib/pipeline/schema";
import type { Accent } from "@/lib/ui/colors";

/** Plain-English, newcomer-facing description of each node type. Shared by the Add-node
 *  menu, the right-click canvas menu, and the node popover so the vocabulary stays in one place. */
export const KIND_LABEL: Record<NodeType, string> = {
  input: "Input",
  agent: "Agent",
  tool: "Tool",
  transformer: "Transformer",
  evaluator: "Evaluator",
  output: "Output",
};

export const KIND_DESCRIPTION: Record<NodeType, string> = {
  input: "Where the pipeline's starting data or question comes in",
  agent: "An AI step — a single agent or a team — that thinks and produces output",
  tool: "Calls an external tool, API, or function",
  transformer: "Reshapes or reformats data between steps",
  evaluator: "Scores, checks, or guards the quality of an output",
  output: "The final result the pipeline produces",
};

export const KIND_ACCENT: Record<NodeType, Accent> = {
  input: "cyan",
  agent: "violet",
  tool: "blue",
  transformer: "slate",
  evaluator: "pink",
  output: "gold",
};

/** "a" / "an" by leading vowel sound — fixes copy like "Added a Agent node". */
export function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
