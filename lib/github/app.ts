import { createSign } from "node:crypto";
import type { GitHubPermissionSummary, GitHubRepositoryRef } from "./types";

/** GitHub App authentication — SERVER ONLY. Mints short-lived installation access tokens
 *  from the App's private key (RS256 JWT → installation token). The App private key and
 *  installation tokens are never sent to the client, stored in pipeline JSON, or exported. */

const GITHUB_API = "https://api.github.com";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function privateKeyPem(): string {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!raw) throw new Error("GITHUB_APP_PRIVATE_KEY is not set.");
  // Support both real newlines and \n-escaped single-line env values.
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/** Build a 10-minute App JWT (used to talk to /app/* endpoints). */
export function buildAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("GITHUB_APP_ID is not set.");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 30, exp: now + 9 * 60, iss: appId };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem());
  return `${signingInput}.${b64url(signature)}`;
}

async function appFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${buildAppJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub App API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Exchange the App JWT for a 1-hour installation access token. */
export async function getInstallationToken(installationId: string): Promise<string> {
  const data = await appFetch<{ token: string }>(`/app/installations/${installationId}/access_tokens`, {
    method: "POST",
  });
  return data.token;
}

type InstallationResponse = {
  id: number;
  account?: { login?: string; type?: string; avatar_url?: string; id?: number } | null;
  permissions?: Record<string, string>;
  repository_selection?: string;
};

function mapPermissions(p?: Record<string, string>): GitHubPermissionSummary {
  const lvl = (v?: string): "read" | "write" | undefined =>
    v === "write" || v === "admin" ? "write" : v === "read" ? "read" : undefined;
  return {
    contents: lvl(p?.contents),
    pullRequests: lvl(p?.pull_requests),
    issues: lvl(p?.issues),
    metadata: lvl(p?.metadata),
  };
}

/** Fetch installation metadata (account, permissions) via the App JWT. */
export async function getInstallation(installationId: string): Promise<{
  installationId: string;
  accountLogin: string | null;
  accountType: "user" | "organization" | null;
  avatarUrl: string | null;
  githubUserId: string | null;
  permissions: GitHubPermissionSummary;
}> {
  const inst = await appFetch<InstallationResponse>(`/app/installations/${installationId}`);
  const type = inst.account?.type?.toLowerCase();
  return {
    installationId: String(inst.id),
    accountLogin: inst.account?.login ?? null,
    accountType: type === "organization" ? "organization" : type === "user" ? "user" : null,
    avatarUrl: inst.account?.avatar_url ?? null,
    githubUserId: inst.account?.id != null ? String(inst.account.id) : null,
    permissions: mapPermissions(inst.permissions),
  };
}

type RepoResponse = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: { login: string };
};

function mapRepo(r: RepoResponse, installationId: string, permissions?: GitHubPermissionSummary): GitHubRepositoryRef {
  return {
    id: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    installationId,
    permissions,
    lastSyncedAt: new Date().toISOString(),
  };
}

/** List repositories an installation can access (uses the installation token). */
export async function listInstallationRepositories(
  installationId: string,
  permissions?: GitHubPermissionSummary,
): Promise<GitHubRepositoryRef[]> {
  const token = await getInstallationToken(installationId);
  const repos: GitHubRepositoryRef[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${GITHUB_API}/installation/repositories?per_page=100&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) break;
    const data = (await res.json()) as { repositories?: RepoResponse[] };
    const batch = data.repositories ?? [];
    for (const r of batch) repos.push(mapRepo(r, installationId, permissions));
    if (batch.length < 100) break;
  }
  return repos;
}
