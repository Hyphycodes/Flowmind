"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Unlink } from "lucide-react";
import { GithubMark } from "./GithubMark";
import type { GitHubStatusResponse } from "@/lib/github/types";

/** GitHub repo connection card. SEPARATE from GitHub sign-in — this authorizes the Flowmind
 *  GitHub App on selected repos. Never shows tokens; they stay server-side. */
export function GitHubConnection() {
  const [status, setStatus] = useState<GitHubStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/github/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false }));

  useEffect(() => {
    void load();
  }, []);

  const unlink = async () => {
    setBusy(true);
    await fetch("/api/github/disconnect", { method: "POST" }).catch(() => {});
    await load();
    setBusy(false);
  };

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-ink-faint">
        <Loader2 size={13} className="animate-spin" /> Checking GitHub…
      </div>
    );
  }

  const perms = status.permissions
    ? Object.entries(status.permissions)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}:${v}`)
    : [];

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <GithubMark size={20} className="shrink-0 text-ink" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">GitHub Repositories</div>
          <div className="text-[11px] text-ink-faint">
            {status.connected
              ? `Connected${status.accountLogin ? ` · ${status.accountLogin}` : ""}${status.accountType ? ` (${status.accountType})` : ""}`
              : status.configured
                ? "Repo access not connected"
                : "Not configured in this deployment"}
          </div>
        </div>
        {status.connected ? (
          <button
            onClick={() => void unlink()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-ink-dim transition hover:text-red disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />} Unlink
          </button>
        ) : status.configured ? (
          <a
            href="/api/github/connect"
            className="flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/[0.1] px-2.5 py-1.5 text-[12px] font-medium text-violet transition hover:bg-violet/[0.18]"
          >
            <Link2 size={12} /> Connect
          </a>
        ) : null}
      </div>

      {status.connected && (
        <div className="mt-2.5 space-y-1.5 border-t border-line/60 pt-2.5 text-[11px]">
          {perms.length ? (
            <div className="flex items-start gap-1.5 text-ink-dim">
              <Check size={12} className="mt-0.5 shrink-0 text-green" />
              <span>Permissions: {perms.join(", ")}</span>
            </div>
          ) : null}
          <p className="text-ink-faint">
            {status.repositories?.length
              ? `${status.repositories.length} repo(s) accessible. `
              : "All-repo access. "}
            Flowmind pushes branches/PRs only when you ask. It never exports your GitHub tokens.
          </p>
        </div>
      )}

      {!status.configured && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
          To enable: create a GitHub App and set <code className="font-mono">GITHUB_APP_ID</code>,{" "}
          <code className="font-mono">GITHUB_APP_PRIVATE_KEY</code>, and{" "}
          <code className="font-mono">NEXT_PUBLIC_GITHUB_APP_SLUG</code> (plus auth +{" "}
          <code className="font-mono">FLOWMIND_TOKEN_ENCRYPTION_SECRET</code>). See{" "}
          <code className="font-mono">docs/GITHUB_INTEGRATION.md</code>.
        </p>
      )}
    </div>
  );
}
