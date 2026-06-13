"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Unlink } from "lucide-react";

type DriveStatus = {
  configured: boolean;
  connected: boolean;
  email?: string | null;
  scopes?: string[];
  filesCount?: number;
  connectedAt?: string | null;
  message?: string;
};

export function ConnectedAccounts() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/google/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false }));

  useEffect(() => {
    void load();
  }, []);

  const unlink = async () => {
    setBusy(true);
    await fetch("/api/google/disconnect", { method: "POST" }).catch(() => {});
    await load();
    setBusy(false);
  };

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-ink-faint">
        <Loader2 size={13} className="animate-spin" /> Checking connections…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <GoogleDriveMark />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">Google Drive</div>
          <div className="text-[11px] text-ink-faint">
            {status.connected
              ? `Connected${status.email ? ` · ${status.email}` : ""}`
              : status.configured
                ? "Not connected"
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
            href="/api/google/connect"
            className="flex items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/[0.1] px-2.5 py-1.5 text-[12px] font-medium text-violet transition hover:bg-violet/[0.18]"
          >
            <Link2 size={12} /> Connect
          </a>
        ) : null}
      </div>

      {status.connected && (
        <div className="mt-2.5 space-y-1.5 border-t border-line/60 pt-2.5 text-[11px]">
          {status.scopes?.length ? (
            <div className="flex items-start gap-1.5 text-ink-dim">
              <Check size={12} className="mt-0.5 shrink-0 text-green" />
              <span>Scopes: {status.scopes.map((s) => s.replace("https://www.googleapis.com/auth/", "")).join(", ")}</span>
            </div>
          ) : null}
          <p className="text-ink-faint">
            {status.filesCount ? `${status.filesCount} file(s) accessible. ` : ""}
            Flowmind only uses files you attach to a node. It never exports your OAuth tokens.
          </p>
        </div>
      )}

      {!status.configured && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
          To enable: set <code className="font-mono">GOOGLE_CLIENT_ID</code>,{" "}
          <code className="font-mono">GOOGLE_CLIENT_SECRET</code>, and{" "}
          <code className="font-mono">FLOWMIND_TOKEN_ENCRYPTION_SECRET</code>. See{" "}
          <code className="font-mono">docs/GOOGLE_DRIVE_CONNECTOR.md</code>.
        </p>
      )}
    </div>
  );
}

function GoogleDriveMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 87.3 78" aria-hidden className="shrink-0">
      <path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" />
      <path fill="#00ac47" d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.45C.4 49.85 0 51.4 0 52.95h27.5z" />
      <path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" />
      <path fill="#00832d" d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" />
      <path fill="#2684fc" d="M59.8 52.95H27.5L13.75 76.8c1.35.75 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
      <path fill="#ffba00" d="M73.4 26.5 60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 27.95h27.45c0-1.55-.4-3.1-1.2-4.5z" />
    </svg>
  );
}
