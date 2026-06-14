import type { GitHubFileChange, GitHubFileChangeResult, GitHubIssueDraft } from "./types";

/** Thin GitHub REST client bound to an installation access token. SERVER ONLY — the token
 *  is passed in by the route after it mints one; it never reaches the browser. */

const GITHUB_API = "https://api.github.com";

export class GitHubClient {
  constructor(
    private token: string,
    private owner: string,
    private repo: string,
  ) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub ${init?.method ?? "GET"} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  /** Resolve the SHA of a branch's tip (used as the base for a new branch). */
  async getBranchSha(branch: string): Promise<string> {
    const data = await this.req<{ object: { sha: string } }>(
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    return data.object.sha;
  }

  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.getBranchSha(branch);
      return true;
    } catch {
      return false;
    }
  }

  /** Create a branch off `baseBranch`. Returns false if it already exists. */
  async createBranch(branch: string, baseBranch: string): Promise<boolean> {
    if (await this.branchExists(branch)) return false;
    const sha = await this.getBranchSha(baseBranch);
    await this.req(`/repos/${this.owner}/${this.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    });
    return true;
  }

  /** Top-level entries of a branch (for repo-structure detection). */
  async getRootEntries(branch: string): Promise<Array<{ name: string; type: string }>> {
    try {
      const data = await this.req<Array<{ name: string; type: string }>>(
        `/repos/${this.owner}/${this.repo}/contents?ref=${encodeURIComponent(branch)}`,
      );
      return Array.isArray(data) ? data.map((e) => ({ name: e.name, type: e.type })) : [];
    } catch {
      return [];
    }
  }

  /** Recursive git tree (paths only). Best-effort; truncates large repos. */
  async getTree(branch: string): Promise<Array<{ path: string; type: string }>> {
    const sha = await this.getBranchSha(branch);
    const data = await this.req<{ tree: Array<{ path: string; type: string }> }>(
      `/repos/${this.owner}/${this.repo}/git/trees/${sha}?recursive=1`,
    );
    return (data.tree ?? []).map((t) => ({ path: t.path, type: t.type }));
  }

  /** Existing blob SHA at a path on a branch, or null when the file does not exist. */
  async getFileSha(path: string, branch: string): Promise<string | null> {
    try {
      const data = await this.req<{ sha: string }>(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
      );
      return data.sha ?? null;
    } catch {
      return null;
    }
  }

  /** Read a file's decoded text content (used by repo source/tool reads). */
  async readFile(path: string, ref?: string): Promise<{ text: string; sha: string } | null> {
    try {
      const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const data = await this.req<{ content: string; encoding: string; sha: string }>(
        `/repos/${this.owner}/${this.repo}/contents/${encodeURI(path)}${q}`,
      );
      const text = data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf8") : data.content;
      return { text, sha: data.sha };
    } catch {
      return null;
    }
  }

  /** Commit a single file (create or update) onto a branch. */
  async putFile(file: GitHubFileChange, branch: string, message: string): Promise<GitHubFileChangeResult> {
    try {
      const body: Record<string, unknown> = {
        message,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch,
      };
      const existingSha = file.sha ?? (await this.getFileSha(file.path, branch));
      if (existingSha) body.sha = existingSha;
      await this.req(`/repos/${this.owner}/${this.repo}/contents/${encodeURI(file.path)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { path: file.path, status: existingSha ? "updated" : "created" };
    } catch (err) {
      return { path: file.path, status: "failed", message: (err as Error).message };
    }
  }

  async getLatestCommitSha(branch: string): Promise<string | undefined> {
    try {
      return await this.getBranchSha(branch);
    } catch {
      return undefined;
    }
  }

  async createPullRequest(input: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<{ number: number; html_url: string }> {
    return this.req<{ number: number; html_url: string }>(`/repos/${this.owner}/${this.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createIssue(draft: GitHubIssueDraft): Promise<{ number: number; html_url: string }> {
    return this.req<{ number: number; html_url: string }>(`/repos/${this.owner}/${this.repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title: draft.title, body: draft.body, labels: draft.labels ?? [] }),
    });
  }

  async listIssues(state: "open" | "closed" | "all" = "open"): Promise<unknown[]> {
    return this.req<unknown[]>(`/repos/${this.owner}/${this.repo}/issues?state=${state}&per_page=50`);
  }

  async listPullRequests(state: "open" | "closed" | "all" = "open"): Promise<unknown[]> {
    return this.req<unknown[]>(`/repos/${this.owner}/${this.repo}/pulls?state=${state}&per_page=50`);
  }
}
