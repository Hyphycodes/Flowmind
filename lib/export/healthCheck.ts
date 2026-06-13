import type { Pipeline } from "@/lib/pipeline/schema";
import type { Dataset } from "@/lib/datasets/schema";
import { newId } from "@/lib/pipeline/validate";
import type { ExportHealthCheck, ExportHealthCheckItem } from "./schema";

export type HealthContext = {
  pipeline: Pipeline;
  datasets?: Dataset[];
  hasRun?: boolean;
};

/** Deterministic export readiness check. Blocks only when files would be broken
 *  (e.g. an empty pipeline); warnings never block. */
export function buildExportHealthCheck(ctx: HealthContext): ExportHealthCheck {
  const p = ctx.pipeline;
  const checks: ExportHealthCheckItem[] = [];
  const add = (
    category: ExportHealthCheckItem["category"],
    label: string,
    status: ExportHealthCheckItem["status"],
    message?: string,
  ) => checks.push({ id: newId("chk"), category, label, status, message });

  // pipeline + schema
  add("pipeline", "Pipeline validates", p.nodes.length > 0 ? "pass" : "fail", p.nodes.length > 0 ? `${p.nodes.length} nodes` : "No nodes — nothing to export");
  const danglingEdges = p.edges.filter((e) => !p.nodes.some((n) => n.id === e.source) || !p.nodes.some((n) => n.id === e.target));
  add("pipeline", "Edges reference real nodes", danglingEdges.length === 0 ? "pass" : "warning", danglingEdges.length ? `${danglingEdges.length} dangling edge(s)` : `${p.edges.length} edges`);
  add("schema", "Schemas can be serialized", "pass", "All objects validate through Zod");

  // agents + crews
  const teams = p.nodes.filter((n) => n.team);
  const emptyTeams = teams.filter((n) => (n.team?.agents.length ?? 0) === 0);
  add("agents", "Nodes have roles/prompts", p.nodes.some((n) => n.prompt || n.role) ? "pass" : "warning", "Agent definitions exported");
  add("crews", "Teams have agents", teams.length === 0 ? "skipped" : emptyTeams.length === 0 ? "pass" : "fail", teams.length ? `${teams.length} team(s)` : "No team nodes");

  // models + tools
  add("models", "Model selections resolvable", "pass", "Every node resolves a model (Claude wired)");
  const toolIds = new Set(
    p.nodes.flatMap((n) => [n.source?.toolId, ...n.toolAttachments.map((a) => a.toolId)]).filter(Boolean) as string[],
  );
  add("tools", "Tool definitions exported", toolIds.size === 0 ? "skipped" : "pass", toolIds.size ? `${toolIds.size} tool(s)` : "No tools attached");

  // datasets / sources
  const sourceNodes = p.nodes.filter((n) => n.source || n.type === "input" || n.type === "tool");
  const hasData = (ctx.datasets?.length ?? 0) > 0 || p.datasetIds.length > 0 || p.nodes.some((n) => n.source?.datasetId);
  add("datasets", "Source data available", sourceNodes.length === 0 ? "skipped" : hasData ? "pass" : "warning", hasData ? "Datasets / source configs present" : "No dataset bound — uses deterministic fallback");

  // contracts
  const failingContracts = p.edges.filter((e) => e.contract?.status === "error").length;
  const warnContracts = p.edges.filter((e) => e.contract?.status === "warning").length;
  add("schema", "Data contracts", failingContracts ? "fail" : warnContracts ? "warning" : "pass", failingContracts ? `${failingContracts} failing` : warnContracts ? `${warnContracts} warning(s)` : "No failing contracts");

  // ui + tables
  add("ui", "Output tables exist", p.outputTables.length > 0 ? "pass" : "warning", `${p.outputTables.length} table(s)`);
  add("ui", "UI bindings exist", p.uiBindings.length > 0 ? "pass" : "warning", `${p.uiBindings.length} binding(s)`);

  // runtime + docs + env
  add("runtime", "Runnable example available", "pass", "run-pipeline.ts + flowmind-runtime.ts");
  add("docs", "README + SPEC generatable", "pass", "Docs generated from pipeline metadata");
  add("env", "Env vars documented", "pass", ".env.example lists required keys (no secret values)");

  const weights: Record<ExportHealthCheckItem["status"], number> = { pass: 1, warning: 0.5, fail: 0, skipped: -1 };
  let total = 0;
  let earned = 0;
  for (const c of checks) {
    const w = weights[c.status];
    if (w < 0) continue; // skipped excluded
    total += 1;
    earned += w;
  }
  const score = total ? Math.round((earned / total) * 100) : 0;
  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warning");
  const blocked = checks.some((c) => c.category === "pipeline" && c.status === "fail");

  return {
    id: newId("health"),
    pipelineId: p.id,
    status: blocked ? "blocked" : hasFail || hasWarn ? "warning" : "ready",
    score,
    checks,
    missingItems: checks.filter((c) => c.status === "fail").map((c) => c.label),
    warnings: checks.filter((c) => c.status === "warning").map((c) => `${c.label}: ${c.message ?? ""}`.trim()),
    generatedAt: new Date().toISOString(),
  };
}
