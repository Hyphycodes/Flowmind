import { getGitHubContext, clientForRepo, ERROR_STATUS } from "@/lib/github/server";
import { pipelineSchema, productDropSchema, realityMeterSchema } from "@/lib/pipeline/schema";
import { collectExportFiles, type ExportContext } from "@/lib/export/bundle";
import { EXPORT_MODES, type ExportMode } from "@/lib/export/schema";
import { generateProductDrop } from "@/lib/product/productDrop";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { scanExportFilesForSecrets } from "@/lib/github/secretScan";
import { commitExportToRepo } from "@/lib/github/exportToRepo";
import {
  generatePullRequestBody,
  defaultPullRequestTitle,
  defaultBranchName,
} from "@/lib/github/pullRequests";
import type { GitHubExportTarget } from "@/lib/github/types";
import { getBillingAccount, logCreditEvent, incrementUsageCounter } from "@/lib/billing/usage";
import { canCreateGitHubPr } from "@/lib/billing/featureGates";
import { CREDIT_COST } from "@/lib/billing/credits";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Push a Flowmind export into a connected repo: create a branch, commit the export bundle,
 *  optionally open a PR. Reuses the EXACT export bundle logic. Secrets are scanned + blocked. */
export async function POST(req: Request) {
  const ctx = await getGitHubContext();
  if ("error" in ctx) return Response.json({ error: ctx.error }, { status: ERROR_STATUS[ctx.error] });

  let payload: {
    target?: GitHubExportTarget;
    pipeline?: unknown;
    run?: ExportContext["run"];
    productDrop?: unknown;
    realityMeter?: unknown;
    modes?: string[];
  };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const target = payload.target;
  if (!target?.repository?.owner || !target?.repository?.name) {
    return Response.json({ error: "Missing target repository" }, { status: 400 });
  }

  const parsedPipeline = pipelineSchema.safeParse(payload.pipeline);
  if (!parsedPipeline.success) {
    return Response.json({ error: "Invalid pipeline", details: parsedPipeline.error.flatten() }, { status: 400 });
  }
  const pipeline = parsedPipeline.data;

  // Billing gate: GitHub PR export is a Pro/Studio feature + monthly limit (no-op when off).
  if (target.createPullRequest) {
    const account = await getBillingAccount();
    const gate = canCreateGitHubPr(account);
    if (!gate.allowed) return Response.json({ error: gate.reason ?? "GitHub PR export not available", gate }, { status: 402 });
  }

  const client = await clientForRepo(ctx, target.repository.owner, target.repository.name);
  if ("error" in client) return Response.json({ error: client.error }, { status: ERROR_STATUS[client.error] });

  // Derive product context (tolerate missing/partial payloads).
  const drop = productDropSchema.safeParse(payload.productDrop).success
    ? productDropSchema.parse(payload.productDrop)
    : generateProductDrop(pipeline);
  const reality = realityMeterSchema.safeParse(payload.realityMeter).success
    ? realityMeterSchema.parse(payload.realityMeter)
    : calculateRealityMeter(pipeline, {});

  const requested = Array.isArray(payload.modes)
    ? (payload.modes.filter((m) => EXPORT_MODES.includes(m as ExportMode)) as ExportMode[])
    : [];
  const modes: ExportMode[] = requested.length ? requested : ["developer", "runtime", "api"];
  const exportCtx: ExportContext = {
    pipeline,
    run: payload.run ?? null,
    productDrop: drop,
    realityMeter: reality,
  };

  // Reuse the export bundle, then run the export safety check before any write.
  const { files, manifest, slug } = collectExportFiles(exportCtx, modes);
  const findings = scanExportFilesForSecrets(files);
  if (findings.length > 0) {
    return Response.json(
      { error: "secret_scan_blocked", findings: findings.map((f) => ({ path: f.path, rule: f.rule, line: f.line })) },
      { status: 422 },
    );
  }

  const branchName = target.branchName || defaultBranchName(slug);
  const prTitle = target.pullRequestTitle || defaultPullRequestTitle(drop, pipeline);
  const prBody =
    target.pullRequestBody ||
    generatePullRequestBody({
      pipeline,
      drop,
      reality,
      health: manifest.healthCheck,
      destinationPath: target.destinationPath || `flowmind/${slug}`,
      fileCount: files.length,
      modes,
    });

  const result = await commitExportToRepo({
    client,
    target: {
      ...target,
      branchName,
      destinationPath: target.destinationPath || `flowmind/${slug}`,
    },
    files,
    pipelineId: pipeline.id,
    exportId: manifest.exportId,
    prTitle,
    prBody,
  });

  // Best-effort persistence (degrades gracefully without the table).
  try {
    await ctx.sb.from("github_exports").insert({
      user_id: ctx.user.id,
      pipeline_id: pipeline.id,
      export_id: manifest.exportId,
      repository_full_name: result.repositoryFullName,
      branch_name: result.branchName,
      base_branch: result.baseBranch,
      destination_path: result.destinationPath,
      commit_sha: result.commitSha,
      pull_request_number: result.pullRequestNumber,
      pull_request_url: result.pullRequestUrl,
      files_changed: result.filesChanged,
      status: result.status,
      error: result.error,
    });
  } catch {
    // table not migrated yet — ignore
  }

  // Billing: count the export + (for PRs) a small credit + counter (no-op when billing is off).
  if (result.status !== "error") {
    void incrementUsageCounter("exports", 1);
    if (target.createPullRequest && result.pullRequestUrl) {
      void incrementUsageCounter("githubPrExports", 1);
      void logCreditEvent({ eventType: "github_pr_export", creditsDelta: -CREDIT_COST.githubPrExport, pipelineId: pipeline.id });
    }
  }

  return Response.json({ result });
}
