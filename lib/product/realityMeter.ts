import type { Pipeline, RealityMeter } from "@/lib/pipeline/schema";

/** Deterministic Reality Meter. Scores how buildable/real a product is from pipeline
 *  readiness signals — never random AI fluff. Authored narrative fields (hardestPart,
 *  fastestMvpPath, …) are preserved when present; the score is always recomputed. */

export type RealityContext = {
  contractsPassing?: boolean;
  latestTakeSuccess?: boolean;
  exportComplete?: boolean;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function calculateRealityMeter(pipeline: Pipeline, ctx: RealityContext = {}): RealityMeter {
  const prev = pipeline.realityMeter;
  const sourceNodes = pipeline.nodes.filter((n) => n.source || n.type === "input" || n.type === "tool");
  const hasDataset =
    pipeline.datasetIds.length > 0 || pipeline.nodes.some((n) => n.source?.datasetId);
  const hasLiveSource = pipeline.nodes.some((n) => n.source?.mode === "live_api");
  const tables = pipeline.outputTables;
  const hasTables = tables.length > 0;
  const hasBindings = pipeline.uiBindings.length > 0;
  const hasEvaluator = pipeline.nodes.some((n) => n.type === "evaluator" || (n.evalDimensions?.length ?? 0) > 0);
  const hasTeams = pipeline.nodes.some((n) => n.team);

  // Contracts
  const contracts = pipeline.edges.map((e) => e.contract).filter(Boolean) as NonNullable<Pipeline["edges"][number]["contract"]>[];
  const failing = contracts.filter((c) => c.status === "error").length;
  const warning = contracts.filter((c) => c.status === "warning").length;
  const contractsOk = ctx.contractsPassing ?? (contracts.length > 0 && failing === 0 && warning === 0);

  // Missing APIs/data
  const missingApis = prev?.missing?.length
    ? prev.missing
    : Array.from(
        new Set(
          [
            ...(pipeline.blueprint?.missingApis ?? []),
            ...pipeline.nodes
              .filter((n) => n.source?.mode === "live_api" && !n.source?.datasetId && !n.source?.fallbackDatasetId)
              .map((n) => `${n.title} live source`),
          ].filter(Boolean),
        ),
      );
  const missingData = hasDataset ? [] : sourceNodes.map((n) => `${n.title} data`).slice(0, 3);

  // ── score ──
  let score = 30;
  if (hasDataset || hasLiveSource) score += 15;
  if (contractsOk) score += 15;
  else if (contracts.length && failing === 0) score += 7;
  score += 10; // model selections are always resolvable (Claude is wired)
  if (hasTables) score += 10;
  if (hasBindings) score += 10;
  if (ctx.latestTakeSuccess) score += 10;
  if (hasEvaluator) score += 8;
  if (ctx.exportComplete ?? (hasTables && hasBindings)) score += 5;
  score -= Math.min(missingApis.length * 8, 16);
  if (failing > 0) score -= 10;
  if (hasTeams && !hasEvaluator) score -= 4;
  score = clamp(score);

  const label: RealityMeter["label"] =
    !hasDataset && !hasTables
      ? "needs_data"
      : score >= 85
        ? "production_shaped"
        : score >= 70
          ? "buildable"
          : score >= 55
            ? "prototype_ready"
            : "rough_idea";

  const readyTools = pipeline.nodes.filter((n) => n.source?.datasetId).length;
  const missingTools = pipeline.nodes.filter(
    (n) => n.source?.mode === "live_api" && !n.source?.datasetId && !n.source?.fallbackDatasetId,
  ).length;

  return {
    buildability: score,
    label,
    missing: missingApis,
    missingData,
    hardestPart: prev?.hardestPart || (hasTeams ? "Coordinating teams + reliable real-time source data." : "Reliable source data."),
    fastestMvpPath:
      prev?.fastestMvpPath || (hasDataset ? "Use the Input Studio dataset; wire live APIs after." : "Generate a strong Input Studio dataset first."),
    costRisk: prev?.costRisk ?? "medium",
    complexityRisk: prev?.complexityRisk ?? (hasTeams ? "high" : "medium"),
    dataQualityRisk: prev?.dataQualityRisk ?? (hasDataset ? "medium" : "high"),
    modelRisk: "low",
    recommendedNext: prev?.recommendedNext || (missingApis[0] ? `Wire ${missingApis[0]}.` : hasEvaluator ? "Run a Take and compare." : "Add an evaluator on the key output."),
    recommendedNextFeature: prev?.recommendedNext || (missingApis[0] ? `Attach ${missingApis[0]}` : "Add a quality evaluator"),
    fakeFirst: prev?.fakeFirst?.length ? prev.fakeFirst : missingApis.slice(0, 2),
    automateLater: prev?.automateLater ?? [],
    toolReadiness: { ready: readyTools, missing: missingTools, warnings: warning ? [`${warning} contract warning(s)`] : [] },
    exportReadiness: { ready: hasTables && hasBindings, missingItems: [!hasTables && "output tables", !hasBindings && "UI bindings"].filter(Boolean) as string[] },
    notes: prev?.notes,
  };
}
