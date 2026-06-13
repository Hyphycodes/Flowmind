import type { Pipeline, ProductDrop, RealityMeter } from "@/lib/pipeline/schema";

export type ExplainAudience = "founder" | "developer" | "client" | "missing" | "weak" | "dataflow";

export const EXPLAIN_OPTIONS: { id: ExplainAudience; label: string }[] = [
  { id: "founder", label: "Like a founder" },
  { id: "developer", label: "Like a developer" },
  { id: "client", label: "Like a client" },
  { id: "missing", label: "What's missing" },
  { id: "weak", label: "Where it's weak" },
  { id: "dataflow", label: "How data moves" },
];

/** Explain the current pipeline in plain language, using Product Drop + Reality Meter +
 *  packets. Deterministic — no model required. */
export function explainProductBlueprint(
  pipeline: Pipeline,
  drop: ProductDrop,
  reality: RealityMeter,
  audience: ExplainAudience = "founder",
): string {
  const teams = pipeline.nodes.filter((n) => n.team);
  const sources = pipeline.nodes.filter((n) => n.layer === "source" || n.type === "input" || n.type === "tool");
  const surfaces = pipeline.nodes.filter((n) => n.layer === "surface" || n.type === "output");

  switch (audience) {
    case "founder":
      return `${drop.name} ${drop.pitch ? `— ${drop.pitch}` : ""}\n\nIt serves ${drop.targetUser || "its users"} and turns ${(drop.keySources ?? sources.map((s) => s.title)).join(", ") || "raw inputs"} into ${(drop.keySurfaces ?? surfaces.map((s) => s.title)).join(", ") || "a usable result"}. ${reality.buildability}% buildable today${reality.missing?.length ? `; still needs ${reality.missing.join(", ")}.` : "."}`;
    case "developer":
      return `${pipeline.nodes.length} nodes, ${teams.length} team(s), ${pipeline.outputTables.length} output table(s), ${pipeline.uiBindings.length} UI binding(s). Source → Brain → Surface. Models wired via the registry; sources via Input Studio datasets with live fallbacks. Contracts validate field handoffs between teams.`;
    case "client":
      return `${drop.name} ${drop.coreValue ? `helps you ${drop.coreValue.toLowerCase()}` : "automates this workflow"}. You give it a brief; it does the work across ${teams.length || pipeline.nodes.length} steps and shows you ${(drop.keySurfaces ?? []).slice(0, 3).join(", ") || "a clean result"} you can act on.`;
    case "missing":
      return reality.missing?.length || reality.missingData?.length
        ? `Missing: ${[...(reality.missing ?? []), ...(reality.missingData ?? [])].join(", ")}. Fastest MVP: ${reality.fastestMvpPath}.`
        : `Nothing critical is missing — ${reality.buildability}% buildable. Next: ${reality.recommendedNextFeature ?? reality.recommendedNext}.`;
    case "weak":
      return `Weakest spots: ${reality.hardestPart}. Complexity risk ${reality.complexityRisk}, data-quality risk ${reality.dataQualityRisk}.${pipeline.nodes.some((n) => n.type === "evaluator") ? "" : " No evaluator yet — add one to guard the key output."}`;
    case "dataflow":
      return pipeline.edges
        .map((e) => {
          const from = pipeline.nodes.find((n) => n.id === e.source)?.title ?? e.source;
          const to = pipeline.nodes.find((n) => n.id === e.target)?.title ?? e.target;
          return `${from} → ${to}${e.dataKey ? ` (${e.dataKey})` : ""}`;
        })
        .join("\n") || "No connections yet.";
    default:
      return drop.pitch;
  }
}
