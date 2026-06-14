import { newId } from "@/lib/pipeline/validate";
import type { ExportFile } from "@/lib/export/bundle";
import { GitHubClient } from "./client";
import type { GitHubExportResult, GitHubExportTarget, GitHubFileChangeResult } from "./types";

/** Convert in-memory export files into a destination-pathed file list and commit them onto a
 *  branch, optionally opening a PR. Reuses the existing export bundle — no export logic here. */

function joinPath(dir: string, file: string): string {
  const clean = dir.replace(/^\/+|\/+$/g, "");
  return clean ? `${clean}/${file}` : file;
}

export type CommitToRepoInput = {
  client: GitHubClient;
  target: GitHubExportTarget;
  files: ExportFile[];
  pipelineId: string;
  exportId?: string;
  commitMessage?: string;
  prTitle: string;
  prBody: string;
};

export async function commitExportToRepo(input: CommitToRepoInput): Promise<GitHubExportResult> {
  const { client, target, files, pipelineId, exportId } = input;
  const repo = target.repository;
  const base: GitHubExportResult = {
    id: newId("ghexport"),
    pipelineId,
    exportId,
    repositoryFullName: repo.fullName,
    branchName: target.branchName,
    baseBranch: target.baseBranch,
    destinationPath: target.destinationPath,
    filesChanged: [],
    status: "success",
    createdAt: new Date().toISOString(),
  };

  try {
    // Resolve a usable branch name; if it exists, version it so we never clobber work.
    let branchName = target.branchName;
    if (await client.branchExists(branchName)) {
      branchName = `${branchName}-${Date.now().toString(36)}`;
    }
    await client.createBranch(branchName, target.baseBranch);
    base.branchName = branchName;
    base.branchUrl = `${repo.htmlUrl}/tree/${branchName}`;

    const onConflict = target.onConflict ?? "version";
    const results: GitHubFileChangeResult[] = [];
    const message = input.commitMessage ?? `Add Flowmind export: ${repo.fullName} (${files.length} files)`;

    for (const f of files) {
      let path = joinPath(target.destinationPath, f.path);
      if (onConflict !== "overwrite") {
        const existing = await client.getFileSha(path, branchName);
        if (existing) {
          if (onConflict === "skip") {
            results.push({ path, status: "skipped", message: "exists" });
            continue;
          }
          // version: drop alongside under a v2 path so important repo files are never silently overwritten
          path = joinPath(`${target.destinationPath.replace(/\/+$/, "")}-v2`, f.path);
        }
      }
      results.push(await client.putFile({ path, content: f.content }, branchName, message));
    }

    base.filesChanged = results;
    base.commitSha = await client.getLatestCommitSha(branchName);
    if (results.some((r) => r.status === "failed")) base.status = "partial";

    if (target.createPullRequest) {
      const pr = await client.createPullRequest({
        title: input.prTitle,
        body: input.prBody,
        head: branchName,
        base: target.baseBranch,
      });
      base.pullRequestNumber = pr.number;
      base.pullRequestUrl = pr.html_url;
    }

    return base;
  } catch (err) {
    return { ...base, status: "error", error: (err as Error).message };
  }
}
