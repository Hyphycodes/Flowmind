"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  ListChecks,
  Loader2,
  Lock,
  TriangleAlert,
} from "lucide-react";
import { GithubMark } from "./GithubMark";
import { usePipelineStore } from "@/store/pipelineStore";
import type { ExportMode } from "@/lib/export/schema";
import type { GitHubExportResult, GitHubRepositoryRef, GitHubStatusResponse } from "@/lib/github/types";
import { cn } from "@/lib/ui/cn";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pipeline";
}

const DEST_PRESETS = ["flowmind", "src/ai", "lib/flowmind", "app/api/ai"];

/** GitHub repo export (Flows 2–4): pick a repo, choose a branch + destination, preview, then
 *  create a branch / open a PR / draft issues. Reuses the standard export bundle server-side. */
export function GitHubExportPanel({ modes, createPullRequest }: { modes: ExportMode[]; createPullRequest: boolean }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const productDrop = usePipelineStore((s) => s.productDrop);
  const realityMeter = usePipelineStore((s) => s.realityMeter);
  const tables = usePipelineStore((s) => s.tables);
  const finalOutput = usePipelineStore((s) => s.finalOutput);
  const setNotice = usePipelineStore((s) => s.setNotice);

  // `slug` is stable at mount (the panel remounts each time the dialog opens), so it is safe
  // to seed the branch/path defaults from it via lazy initializers — no setState-in-effect.
  const slug = useMemo(() => slugify(productDrop?.name ?? pipeline?.name ?? "pipeline"), [productDrop, pipeline]);

  const [status, setStatus] = useState<GitHubStatusResponse | null>(null);
  const [repoFullName, setRepoFullName] = useState<string>("");
  const [branchName, setBranchName] = useState<string>(() => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `flowmind/${slug}-${stamp}`;
  });
  const [baseBranch, setBaseBranch] = useState<string>("");
  const [destPath, setDestPath] = useState<string>(() => `flowmind/${slug}`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GitHubExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/status")
      .then((r) => r.json())
      .then((s: GitHubStatusResponse) => {
        setStatus(s);
        const repos = s.repositories ?? [];
        if (repos.length) {
          setRepoFullName(repos[0].fullName);
          setBaseBranch(repos[0].defaultBranch);
        }
      })
      .catch(() => setStatus({ configured: false, connected: false }));
  }, []);

  const repos = status?.repositories ?? [];
  const selectRepo = (r: GitHubRepositoryRef) => {
    setRepoFullName(r.fullName);
    setBaseBranch(r.defaultBranch);
  };

  const selectedRepo = repos.find((r) => r.fullName === repoFullName);

  const push = async () => {
    if (!pipeline || !selectedRepo) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/github/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: {
            repository: selectedRepo,
            installationId: selectedRepo.installationId,
            baseBranch: baseBranch || selectedRepo.defaultBranch,
            branchName,
            destinationPath: destPath,
            createPullRequest,
            onConflict: "version",
          },
          pipeline,
          productDrop: productDrop ?? undefined,
          realityMeter: realityMeter ?? undefined,
          run: { tables, finalOutput },
          modes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "secret_scan_blocked"
            ? `Blocked: possible secrets in ${data.findings?.length ?? 0} file(s).`
            : data.error || "GitHub export failed.",
        );
        return;
      }
      setResult(data.result as GitHubExportResult);
      setNotice(
        data.result?.pullRequestUrl
          ? "Opened a pull request on GitHub."
          : "Pushed a branch to GitHub.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── unconfigured / unauthenticated / not-connected states ──
  if (!status) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-[12px] text-ink-faint">
        <Loader2 size={13} className="animate-spin" /> Checking GitHub…
      </div>
    );
  }

  if (!status.configured) {
    return (
      <Note icon={<GithubMark size={14} />}>
        GitHub export isn&apos;t configured in this deployment. Set up a GitHub App
        (<code className="font-mono">GITHUB_APP_ID</code>, <code className="font-mono">GITHUB_APP_PRIVATE_KEY</code>,{" "}
        <code className="font-mono">NEXT_PUBLIC_GITHUB_APP_SLUG</code>). The ZIP export still works.
      </Note>
    );
  }

  if (!status.connected) {
    return (
      <Note icon={<Lock size={14} />}>
        Connect a GitHub repository to push branches and open PRs.
        <a
          href="/api/github/connect"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/[0.1] px-2.5 py-1.5 text-[12px] font-medium text-violet transition hover:bg-violet/[0.18]"
        >
          <GithubMark size={13} /> Connect GitHub
        </a>
      </Note>
    );
  }

  // ── success state ──
  if (result) {
    return (
      <div className="space-y-2 rounded-xl border border-green/30 bg-green/[0.05] p-3 text-[12px]">
        <div className="flex items-center gap-1.5 text-green">
          <CheckCircle2 size={14} /> {result.pullRequestUrl ? "Pull request opened" : "Branch pushed"}
          {result.status === "partial" ? " (partial)" : ""}
        </div>
        <div className="text-[11px] text-ink-dim">
          {result.filesChanged.filter((f) => f.status !== "failed" && f.status !== "skipped").length} file(s) committed to{" "}
          <span className="font-mono">{result.branchName}</span> on {result.repositoryFullName}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.branchUrl && (
            <LinkBtn href={result.branchUrl}>
              <GitBranch size={12} /> View branch
            </LinkBtn>
          )}
          {result.pullRequestUrl && (
            <LinkBtn href={result.pullRequestUrl}>
              <GitPullRequest size={12} /> PR #{result.pullRequestNumber}
            </LinkBtn>
          )}
          {result.pullRequestUrl && (
            <button
              onClick={() => void navigator.clipboard.writeText(result.pullRequestUrl!).then(() => setNotice("Copied PR link."))}
              className="rounded-lg border border-line bg-white/[0.03] px-2 py-1 text-[11px] text-ink-dim transition hover:text-ink"
            >
              Copy PR link
            </button>
          )}
        </div>
        {result.error && <p className="text-[10.5px] text-red">{result.error}</p>}
        <button onClick={() => setResult(null)} className="text-[11px] text-violet hover:underline">
          Export again
        </button>
      </div>
    );
  }

  // ── connected: repo selector + branch/path + preview ──
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
        <GithubMark size={13} /> {status.accountLogin} · {repos.length} repo(s)
      </div>

      <Field label="Repository">
        <select
          value={repoFullName}
          onChange={(e) => {
            const r = repos.find((x) => x.fullName === e.target.value);
            if (r) selectRepo(r);
          }}
          className="w-full rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 text-[12px] text-ink outline-none focus:border-violet/50"
        >
          {repos.length === 0 && <option value="">No repositories</option>}
          {repos.map((r) => (
            <option key={r.fullName} value={r.fullName}>
              {r.fullName} {r.private ? "(private)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Base branch">
          <input
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
            className="w-full rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-violet/50"
          />
        </Field>
        <Field label="New branch">
          <input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="w-full rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-violet/50"
          />
        </Field>
      </div>

      <Field label="Destination folder">
        <input
          value={destPath}
          onChange={(e) => setDestPath(e.target.value)}
          className="w-full rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-violet/50"
        />
        <div className="mt-1 flex flex-wrap gap-1">
          {DEST_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => setDestPath(`${d}/${slug}`)}
              className="rounded border border-line bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-ink-faint transition hover:text-ink"
            >
              {d}/{slug}
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-lg border border-line bg-white/[0.02] p-2.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-ink-dim">
          {createPullRequest ? <GitPullRequest size={12} className="text-violet" /> : <GitBranch size={12} className="text-violet" />}
          {createPullRequest ? "Will open a pull request" : "Will push a branch"}
        </div>
        <div className="mt-1 truncate text-ink-faint">
          {selectedRepo ? `${selectedRepo.fullName} ← ${branchName}` : "Select a repository"}
        </div>
        <div className="mt-0.5 text-ink-faint">Modes: {modes.join(", ")} · existing files versioned, never overwritten</div>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red/30 bg-red/[0.06] p-2 text-[11px] text-red">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => void push()}
          disabled={busy || !selectedRepo || !pipeline}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : createPullRequest ? <GitPullRequest size={13} /> : <GitBranch size={13} />}
          {createPullRequest ? "Create pull request" : "Push branch"}
        </button>
        <GitHubIssuesButton />
      </div>
    </div>
  );
}

/** Draft + create implementation issues from the Reality Meter / health check. */
function GitHubIssuesButton() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const productDrop = usePipelineStore((s) => s.productDrop);
  const realityMeter = usePipelineStore((s) => s.realityMeter);
  const setNotice = usePipelineStore((s) => s.setNotice);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Array<{ title: string; body: string; labels?: string[] }> | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [repoFullName, setRepoFullName] = useState("");
  const [repos, setRepos] = useState<GitHubRepositoryRef[]>([]);
  const [busy, setBusy] = useState(false);

  const preview = async () => {
    if (!pipeline) return;
    setOpen(true);
    setBusy(true);
    const [draftRes, statusRes] = await Promise.all([
      fetch("/api/github/create-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewOnly: true, pipeline, productDrop, realityMeter }),
      }).then((r) => r.json()),
      fetch("/api/github/status").then((r) => r.json()),
    ]).catch(() => [{ drafts: [] }, { repositories: [] }]);
    const ds = draftRes.drafts ?? [];
    setDrafts(ds);
    setPicked(new Set(ds.map((_: unknown, i: number) => i)));
    setRepos(statusRes.repositories ?? []);
    setRepoFullName((statusRes.repositories ?? [])[0]?.fullName ?? "");
    setBusy(false);
  };

  const create = async () => {
    const repo = repos.find((r) => r.fullName === repoFullName);
    if (!repo || !drafts) return;
    setBusy(true);
    const issues = drafts.filter((_, i) => picked.has(i));
    const res = await fetch("/api/github/create-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repository: repo, issues }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (res?.created) {
      const ok = res.created.filter((c: { number?: number }) => c.number).length;
      setNotice(`Created ${ok} GitHub issue(s).`);
      setOpen(false);
    } else {
      setNotice("Could not create issues.");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => void preview()}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ink-dim transition hover:text-ink"
        title="Create implementation issues from the Reality Meter"
      >
        <ListChecks size={13} /> Issues
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-canvas/95 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">Implementation issues</span>
        <button onClick={() => setOpen(false)} className="text-[11px] text-ink-faint hover:text-ink">
          Close
        </button>
      </div>
      {busy && !drafts ? (
        <div className="flex items-center gap-2 text-[12px] text-ink-faint">
          <Loader2 size={13} className="animate-spin" /> Drafting…
        </div>
      ) : (
        <>
          <select
            value={repoFullName}
            onChange={(e) => setRepoFullName(e.target.value)}
            className="mb-2 w-full rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 text-[12px] text-ink outline-none"
          >
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {(drafts ?? []).map((d, i) => (
              <button
                key={i}
                onClick={() =>
                  setPicked((s) => {
                    const n = new Set(s);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border p-2 text-left text-[11.5px] transition",
                  picked.has(i) ? "border-violet/40 bg-violet/[0.06]" : "border-line bg-white/[0.02]",
                )}
              >
                <span className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 rounded border", picked.has(i) ? "border-violet bg-violet" : "border-line-strong")} />
                <span className="min-w-0">
                  <span className="block truncate text-ink">{d.title}</span>
                  <span className="block truncate text-[10px] text-ink-faint">{(d.labels ?? []).join(" · ")}</span>
                </span>
              </button>
            ))}
            {drafts?.length === 0 && <p className="text-[11px] text-ink-faint">No issues to create — pipeline looks complete.</p>}
          </div>
          <button
            onClick={() => void create()}
            disabled={busy || picked.size === 0 || !repoFullName}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <ListChecks size={12} />} Create {picked.size} issue(s)
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-ink-dim">
      <div className="mb-1 flex items-center gap-1.5 text-ink">{icon}</div>
      {children}
    </div>
  );
}

function LinkBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1 rounded-lg border border-line bg-white/[0.03] px-2 py-1 text-[11px] text-ink-dim transition hover:text-ink"
    >
      {children} <ExternalLink size={10} />
    </a>
  );
}
