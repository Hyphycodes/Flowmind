import type { Pipeline, RealityMeter, ProductDrop } from "@/lib/pipeline/schema";
import type { ExportHealthCheck } from "@/lib/export/schema";
import { getTool } from "@/lib/tools/registry";
import { envVarsForTool } from "@/lib/tools/schema";
import type { GitHubIssueDraft } from "./types";

/** Generate implementation issue drafts from the Reality Meter + export health check +
 *  data-contract warnings + missing tools/env vars. Deterministic; the user selects which
 *  to actually create. */

export const DEFAULT_ISSUE_LABELS = ["flowmind", "ai-pipeline"];

export type IssueDraftInput = {
  pipeline: Pipeline;
  reality: RealityMeter;
  drop: ProductDrop;
  health: ExportHealthCheck;
};

export function generateIssueDrafts(input: IssueDraftInput): GitHubIssueDraft[] {
  const { pipeline, reality, drop, health } = input;
  const drafts: GitHubIssueDraft[] = [];
  const seen = new Set<string>();
  const push = (d: GitHubIssueDraft) => {
    const key = d.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    drafts.push(d);
  };

  // 1. Missing APIs / adapters (from ProductDrop + RealityMeter).
  for (const api of [...new Set([...(drop.missingApis ?? []), ...(reality.missing ?? [])])]) {
    push({
      title: `Wire ${api}`,
      body: bodyBlock({
        context: `The pipeline "${drop.name || pipeline.name}" depends on ${api}, which is not yet wired.`,
        expected: `A working adapter so this source/tool returns live data instead of the deterministic fallback.`,
        acceptance: [`${api} is callable from the runtime adapter`, `Falls back gracefully when the key is missing`],
      }),
      labels: [...DEFAULT_ISSUE_LABELS, "integration"],
      priority: "high",
    });
  }

  // 2. Missing env vars (from required tools).
  const toolIds = new Set(
    pipeline.nodes.flatMap((n) => [n.source?.toolId, ...n.toolAttachments.map((a) => a.toolId)]).filter(Boolean) as string[],
  );
  const envVars = new Set<string>();
  for (const id of toolIds) {
    const tool = getTool(id);
    if (tool) for (const env of envVarsForTool(tool)) envVars.add(env);
  }
  for (const env of envVars) {
    push({
      title: `Add env var ${env}`,
      body: bodyBlock({
        context: `A tool/source in this pipeline requires the \`${env}\` environment variable.`,
        expected: `\`${env}\` is set in \`.env.local\` (and the deploy target) — value never committed.`,
        acceptance: [`\`${env}\` present at runtime`, `Documented in \`.env.example\``],
      }),
      labels: [...DEFAULT_ISSUE_LABELS, "env"],
      priority: "medium",
    });
  }

  // 3. Failing / warning data contracts.
  for (const edge of pipeline.edges) {
    if (edge.contract?.status === "error" || edge.contract?.status === "warning") {
      const from = pipeline.nodes.find((n) => n.id === edge.source);
      const to = pipeline.nodes.find((n) => n.id === edge.target);
      push({
        title: `Fix data contract: ${from?.title ?? edge.source} → ${to?.title ?? edge.target}`,
        body: bodyBlock({
          context: `The edge from "${from?.title ?? edge.source}" to "${to?.title ?? edge.target}" has a ${edge.contract.status} data contract.`,
          related: `Edge ${edge.id}`,
          expected: `Produced fields satisfy the consumer's expected fields with no drift.`,
          acceptance: ["Contract status is `ok`", "No dropped/renamed required fields"],
        }),
        labels: [...DEFAULT_ISSUE_LABELS, "data-contract"],
        relatedNodeId: edge.target,
        priority: edge.contract.status === "error" ? "high" : "medium",
      });
    }
  }

  // 4. Missing UI bindings.
  const tablesWithoutBindings = pipeline.outputTables.filter(
    (t) => !pipeline.uiBindings.some((b) => b.tableId === t.id),
  );
  for (const t of tablesWithoutBindings) {
    push({
      title: `Add UI binding for "${t.name}"`,
      body: bodyBlock({
        context: `Output table "${t.name}" has no UI binding, so its data never surfaces in the preview.`,
        expected: `A UI component (table/cards/score) bound to "${t.name}" labelled "powered by ${t.name}".`,
        acceptance: ["A UI binding references this table", "Preview renders rows from it"],
      }),
      labels: [...DEFAULT_ISSUE_LABELS, "ui"],
      priority: "low",
    });
  }

  // 5. Missing evaluator.
  const hasEvaluator = pipeline.nodes.some((n) => n.type === "evaluator" || (n.evalDimensions?.length ?? 0) > 0);
  if (!hasEvaluator) {
    push({
      title: `Add an evaluator for output quality`,
      body: bodyBlock({
        context: `No evaluator/judge node scores this pipeline's output, so quality regressions go undetected.`,
        expected: `An evaluator node scoring the key risk dimensions for "${drop.name || pipeline.name}".`,
        acceptance: ["Evaluator node present", "Eval runs produce per-dimension scores"],
      }),
      labels: [...DEFAULT_ISSUE_LABELS, "evals"],
      priority: "medium",
    });
  }

  // 6. Export health warnings.
  for (const w of health.warnings) {
    push({
      title: `Resolve export warning: ${w.split(":")[0]}`,
      body: bodyBlock({
        context: `The export health check flagged: ${w}`,
        expected: `The warning is resolved so the export is fully production-shaped.`,
        acceptance: ["Export health check passes this item"],
      }),
      labels: [...DEFAULT_ISSUE_LABELS, "export"],
      priority: "low",
    });
  }

  return drafts;
}

function bodyBlock(p: {
  context: string;
  related?: string;
  expected: string;
  acceptance: string[];
}): string {
  return [
    `### Context`,
    p.context,
    p.related ? `\n**Related:** ${p.related}` : "",
    ``,
    `### Expected output`,
    p.expected,
    ``,
    `### Acceptance criteria`,
    p.acceptance.map((a) => `- [ ] ${a}`).join("\n"),
    ``,
    `---`,
    `🤖 Generated by Flowmind from the Reality Meter + export health check.`,
  ]
    .filter(Boolean)
    .join("\n");
}
