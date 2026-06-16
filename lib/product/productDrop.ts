import type { Pipeline, PipelineNode, ProductDrop } from "@/lib/pipeline/schema";

/** Deterministic Product Drop synthesis from a pipeline. Prefers an authored
 *  blueprint, then derives the rest from nodes/teams/tables so the Product tab is
 *  never empty and stays connected to the real architecture. */

function layerOf(n: PipelineNode): "source" | "brain" | "surface" {
  if (n.layer) return n.layer;
  if (n.type === "input" || n.type === "tool") return "source";
  if (n.type === "output") return "surface";
  return "brain";
}

const CATEGORY_HINTS: [RegExp, string, string][] = [
  [/crew|council|team|synthesis|source.?team|multi.?agent/i, "Research Intelligence Crew", "Research Crew Pack"],
  [/content|hook|caption|post|video|script/i, "Content Studio", "Content Studio Pack"],
  [/inbox|email|reply|triage|message/i, "Inbox Operator", "Inbox Operator Pack"],
  [/research|market|competitor|thesis|report/i, "Research Analyst", "Research Analyst Pack"],
  [/outfit|style|fashion|wardrobe/i, "Style Concierge", "Style Pack"],
  [/meal|recipe|nutrition|diet/i, "Food & Nutrition", "Meal Pack"],
];

function categorize(p: Pipeline): { category: string; pack: string } {
  const hay = `${p.name} ${p.description}`;
  for (const [re, category, pack] of CATEGORY_HINTS) if (re.test(hay)) return { category, pack };
  return { category: "AI System", pack: "Starter Pack" };
}

export function generateProductDrop(pipeline: Pipeline): ProductDrop {
  const b = pipeline.blueprint;
  const { category, pack } = categorize(pipeline);

  const sources = pipeline.nodes.filter((n) => layerOf(n) === "source");
  const brains = pipeline.nodes.filter((n) => layerOf(n) === "brain");
  const surfaces = pipeline.nodes.filter((n) => layerOf(n) === "surface");
  const teams = pipeline.nodes.filter((n) => n.team);

  const keySources = b?.keySources?.length
    ? b.keySources
    : Array.from(new Set(sources.map((n) => n.title)));
  const keyTeams = b?.keyTeams?.length
    ? b.keyTeams
    : (teams.length ? teams : brains).map((n) => n.title);
  const keyDataObjects = b?.keyDataObjects?.length
    ? b.keyDataObjects
    : pipeline.outputTables.map((t) => t.name);
  const keySurfaces = b?.keySurfaces?.length
    ? b.keySurfaces
    : pipeline.uiBindings.length
      ? pipeline.uiBindings.map((u) => u.title || u.componentType)
      : surfaces.map((n) => n.title);

  const workflowSummary =
    b?.workflowSummary ||
    [sources[0]?.title, brains[0]?.title, surfaces[0]?.title].filter(Boolean).join(" → ") ||
    pipeline.description;

  const missingApis = b?.missingApis?.length
    ? b.missingApis
    : pipeline.nodes
        .filter((n) => n.source?.mode === "live_api" && !n.source?.datasetId)
        .map((n) => `${n.title} API`);

  const nextBestFeature =
    b?.nextBestFeature ||
    (missingApis[0] ? `Attach ${missingApis[0]}` : pipeline.nodes.some((n) => n.type === "evaluator") ? "Add a premium variation" : "Add a quality evaluator");

  return {
    name: b?.name || pipeline.name,
    pitch: b?.pitch || pipeline.description || `${category} system.`,
    targetUser: b?.targetUser || "",
    vibeTags: b?.vibeTags?.length ? b.vibeTags : [],
    coreValue: b?.coreValue || pipeline.description,
    workflowSummary,
    keyDataObjects,
    uiSurfaces: b?.uiSurfaces?.length ? b.uiSurfaces : keySurfaces,
    missingApis,
    fastestMvpPath: b?.fastestMvpPath || pipeline.realityMeter?.fastestMvpPath || "",
    monetization: b?.monetization || "",
    category: b?.category || category,
    mainUseCase: b?.mainUseCase || workflowSummary,
    keySources,
    keyTeams,
    keySurfaces,
    monetizationAngle: b?.monetizationAngle || b?.monetization || "",
    suggestedPack: b?.suggestedPack || pack,
    nextBestFeature,
  };
}
