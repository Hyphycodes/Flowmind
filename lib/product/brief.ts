import type { Pipeline, ProductBrief, ProductDrop, RealityMeter } from "@/lib/pipeline/schema";
import { newId } from "@/lib/pipeline/validate";

/** A short in-app product brief — what it does, who it serves, how it works, what's
 *  missing, next step. Feeds the Founder Brief / Client Blueprint exports. Deterministic. */
export function generateProductBrief(
  pipeline: Pipeline,
  drop: ProductDrop,
  reality: RealityMeter,
): ProductBrief {
  const ordered = [...pipeline.nodes].sort((a, b) => a.position.x - b.position.x);
  const howItWorks = ordered
    .filter((n) => n.type !== "input")
    .map((n) => `${n.title}${n.team ? ` (${n.team.strategy} team)` : ""} — ${n.description || n.subtitle || n.role || "processes the data"}`)
    .slice(0, 6);

  const missingPieces = Array.from(new Set([...(drop.missingApis ?? []), ...(reality.missingData ?? [])]));
  const nextSteps = [reality.recommendedNext, drop.nextBestFeature]
    .filter((x): x is string => Boolean(x))
    .filter((x, i, a) => a.indexOf(x) === i);

  return {
    id: newId("brief"),
    pipelineId: pipeline.id,
    title: drop.name,
    summary: drop.pitch,
    targetUser: drop.targetUser,
    howItWorks,
    dataNeeded: drop.keyDataObjects ?? [],
    aiTeams: drop.keyTeams ?? [],
    uiSurfaces: drop.keySurfaces ?? drop.uiSurfaces ?? [],
    missingPieces,
    nextSteps: nextSteps.length ? nextSteps : ["Run a Take and review the output."],
    createdAt: new Date().toISOString(),
  };
}
