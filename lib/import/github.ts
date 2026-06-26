import type { SourceFile } from "./detect";

/**
 * Fetch a PUBLIC GitHub repo's source files for static import analysis (Prompt 05, Codebase Import).
 * Server-side only. Read-only: we never write, never store credentials/tokens in the result, and the
 * downstream analyzer extracts structure (not secret values). An optional GITHUB_TOKEN (server env)
 * only lifts rate limits — it is never returned to the client.
 */

const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|md)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|out|\.next|venv|\.venv|env|__pycache__|coverage|vendor|fixtures|migrations|\.github)(\/|$)/i;
const MAX_FILES = 160;
const MAX_BYTES = 200_000;

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const s = input.trim().replace(/^git\+/, "").replace(/\.git$/, "");
  if (!s) return null;
  try {
    if (/github\.com/i.test(s)) {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
      return null;
    }
    // bare "owner/repo"
    const m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (m) return { owner: m[1], repo: m[2] };
  } catch {
    return null;
  }
  return null;
}

// Rank source code ahead of docs so the file cap keeps what matters most.
function rank(path: string): number {
  if (/\.(py|ts|tsx|js|jsx|mjs|cjs)$/i.test(path)) return 0;
  if (/\.md$/i.test(path)) return 2;
  return 1;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "flowmind-import", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function fetchGithubRepo(input: string): Promise<{ name: string; files: SourceFile[] }> {
  const parsed = parseRepoUrl(input);
  if (!parsed) {
    throw new Error("That doesn't look like a GitHub repo URL. Try https://github.com/owner/repo.");
  }
  const { owner, repo } = parsed;

  const meta = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: authHeaders() });
  if (meta.status === 404) throw new Error("Repo not found, or it's private. v1 supports public repos only.");
  if (meta.status === 403) throw new Error("GitHub rate limit reached. Try again shortly, or upload the folder instead.");
  if (!meta.ok) throw new Error(`Couldn't read that repo (HTTP ${meta.status}).`);
  const metaJson = (await meta.json()) as { default_branch?: string; name?: string };
  const branch = metaJson.default_branch || "main";
  const repoName = metaJson.name || repo;

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: authHeaders() },
  );
  if (!treeRes.ok) throw new Error(`Couldn't list the repo's files (HTTP ${treeRes.status}).`);
  const treeJson = (await treeRes.json()) as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean };

  const blobs = (treeJson.tree ?? [])
    .filter((t) => t.type === "blob" && SCAN_EXT.test(t.path) && !SKIP_DIR.test(t.path) && (t.size ?? 0) < MAX_BYTES)
    .sort((a, b) => rank(a.path) - rank(b.path))
    .slice(0, MAX_FILES);

  if (blobs.length === 0) {
    throw new Error("No source files found in that repo (looked for .ts/.tsx/.js/.py).");
  }

  // raw.githubusercontent.com serves file bodies and isn't subject to the API rate limit.
  const files: SourceFile[] = [];
  await Promise.all(
    blobs.map(async (b) => {
      try {
        const path = b.path.split("/").map(encodeURIComponent).join("/");
        const raw = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`, {
          headers: { "User-Agent": "flowmind-import" },
        });
        if (!raw.ok) return;
        const content = await raw.text();
        if (content && content.length < MAX_BYTES) files.push({ path: b.path, content });
      } catch {
        /* skip a file we couldn't read; the analysis is best-effort */
      }
    }),
  );

  if (files.length === 0) throw new Error("Couldn't read any source files from that repo.");
  return { name: repoName, files };
}
