"use client";

import { useEffect, useState } from "react";
import { BarChart3, Check, Copy, DollarSign, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hasSupabase } from "@/lib/supabase/client";
import { listShareRuns, listShares, upsertShare } from "@/lib/supabase/queries";
import { newId } from "@/lib/pipeline/validate";
import {
  SHARE_LEVELS,
  SHARE_LEVEL_COPY,
  pipelineShareSchema,
  type PipelineShare,
  type PricingMode,
  type ShareLevel,
  type ShareRun,
} from "@/lib/sharing/schema";
import { formatUsd } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

export function ShareModal() {
  const open = usePipelineStore((s) => s.shareOpen);
  const close = usePipelineStore((s) => s.closeShare);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const setNotice = usePipelineStore((s) => s.setNotice);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareId, setShareId] = useState<string>("");
  const [level, setLevel] = useState<ShareLevel>("run");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [past, setPast] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [linkToken, setLinkToken] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>("free");
  const [pricingAmount, setPricingAmount] = useState("5");
  const [shareRuns, setShareRuns] = useState<ShareRun[]>([]);

  useEffect(() => {
    if (!open || !pipeline) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state while we fetch the share on open
    setLoading(true);
    void (async () => {
      const shares = hasSupabase() ? await listShares(pipeline.id) : [];
      if (cancelled) return;
      const existing = shares[0];
      setShareId(existing?.id ?? newId("share"));
      setLevel(existing?.level ?? "run");
      setRecipients(existing?.recipients.map((r) => r.email) ?? []);
      setLinkEnabled(existing?.linkEnabled ?? false);
      setLinkToken(existing?.linkToken);
      setPricingMode(existing?.pricing?.mode ?? "free");
      setPricingAmount(existing?.pricing?.amountUsd ? String(existing.pricing.amountUsd) : "5");
      setPast([...new Set(shares.flatMap((s) => s.recipients.map((r) => r.email)))]);
      if (existing?.id) void listShareRuns(existing.id).then((r) => !cancelled && setShareRuns(r));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pipeline]);

  if (!open || !pipeline) return null;

  const addEmail = (e: string) => {
    const v = e.trim().toLowerCase();
    if (v && /\S+@\S+/.test(v) && !recipients.includes(v)) setRecipients((r) => [...r, v]);
    setEmail("");
  };

  const toggleLink = () => {
    if (!linkEnabled) {
      setLinkToken((t) => t ?? cryptoToken());
      setLinkEnabled(true);
    } else {
      setLinkEnabled(false);
    }
  };

  const runUrl = linkToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/run/${linkToken}` : "";

  const save = async () => {
    setSaving(true);
    const share: PipelineShare = pipelineShareSchema.parse({
      id: shareId,
      pipelineId: pipeline.id,
      ownerId: null,
      level,
      recipients: recipients.map((e) => ({ email: e })),
      linkEnabled,
      linkToken,
      pricing: { mode: pricingMode, amountUsd: Number(pricingAmount) || 0, currency: "usd" },
      updatedAt: new Date().toISOString(),
    });
    const ok = hasSupabase() ? await upsertShare(share) : true;
    setSaving(false);
    setNotice(ok ? "Share settings saved." : "Couldn't save the share (no database).");
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-medium text-ink">Share “{pipeline.name}”</h2>
          <button onClick={close} aria-label="Close" className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-ink-faint" size={18} />
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            {/* Levels */}
            <div className="space-y-2">
              {SHARE_LEVELS.map((lv) => (
                <button
                  key={lv}
                  onClick={() => setLevel(lv)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition",
                    level === lv ? "border-violet/60 bg-violet/[0.08]" : "border-line bg-white/[0.02] hover:border-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      level === lv ? "border-violet bg-violet" : "border-line-strong",
                    )}
                  >
                    {level === lv && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="text-[13px] font-medium text-ink">{SHARE_LEVEL_COPY[lv].title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-dim">{SHARE_LEVEL_COPY[lv].blurb}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Recipients */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-ink-faint">Recipients</label>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmail(email);
                    }
                  }}
                  placeholder="name@company.com"
                  className="flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 text-[12.5px] text-ink outline-none focus:border-line-strong"
                />
                <button onClick={() => addEmail(email)} className="rounded-lg border border-line-strong bg-white/[0.04] px-3 text-[12.5px] text-ink transition hover:bg-white/[0.1]">
                  Add
                </button>
              </div>
              {recipients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recipients.map((e) => (
                    <span key={e} className="flex items-center gap-1 rounded-full border border-line bg-white/[0.04] px-2 py-1 text-[11.5px] text-ink-dim">
                      {e}
                      <button onClick={() => setRecipients((r) => r.filter((x) => x !== e))} className="text-ink-faint hover:text-ink">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {past.filter((e) => !recipients.includes(e)).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                  Recent:
                  {past
                    .filter((e) => !recipients.includes(e))
                    .slice(0, 4)
                    .map((e) => (
                      <button key={e} onClick={() => addEmail(e)} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-ink-dim transition hover:text-ink">
                        {e}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Link */}
            <div className="rounded-xl border border-line bg-white/[0.02] p-3">
              <label className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12.5px] text-ink">
                  <Link2 size={14} className="text-violet" /> Anyone with the link can run
                </span>
                <button
                  onClick={toggleLink}
                  className={cn("relative h-5 w-9 rounded-full transition", linkEnabled ? "bg-violet" : "bg-white/[0.12]")}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", linkEnabled ? "left-[18px]" : "left-0.5")} />
                </button>
              </label>
              {linkEnabled && runUrl && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input readOnly value={runUrl} className="flex-1 truncate rounded-lg border border-line bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-ink-dim" />
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(runUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    title="Copy link"
                    className="rounded-lg border border-line-strong bg-white/[0.04] p-1.5 text-ink-dim transition hover:text-ink"
                  >
                    {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => setLinkToken(cryptoToken())}
                    title="Rotate link (invalidates the old one)"
                    className="rounded-lg border border-line-strong bg-white/[0.04] p-1.5 text-ink-dim transition hover:text-ink"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Monetize (run shares) */}
            {level === "run" && (
              <div className="space-y-2.5 rounded-xl border border-line bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  <DollarSign size={12} /> Charge for access
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value as PricingMode)}
                    className="rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-[12.5px] text-ink outline-none"
                  >
                    <option value="free" className="bg-[#14141c]">Free</option>
                    <option value="per_run" className="bg-[#14141c]">Per run</option>
                    <option value="subscription" className="bg-[#14141c]">Subscription</option>
                  </select>
                  {pricingMode !== "free" && (
                    <div className="flex items-center gap-1">
                      <span className="text-ink-faint">$</span>
                      <input
                        value={pricingAmount}
                        onChange={(e) => setPricingAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="w-16 rounded-lg border border-line bg-black/30 px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-line-strong"
                      />
                      <span className="text-[11px] text-ink-faint">{pricingMode === "subscription" ? "/mo" : "per run"}</span>
                    </div>
                  )}
                </div>
                {pricingMode !== "free" && (
                  <p className="rounded-lg border border-gold/30 bg-gold/[0.06] p-2 text-[10.5px] leading-relaxed text-ink-dim">
                    Payments are collected by Flowmind today.{" "}
                    <span className="font-medium text-gold">Owner payouts (Stripe Connect) coming soon</span> — see
                    docs/monetization.md.
                  </p>
                )}
                {shareRuns.length > 0 && <ShareAnalytics runs={shareRuns} />}
              </div>
            )}

            {!hasSupabase() && (
              <p className="text-[11px] leading-relaxed text-gold">
                No database connected — sharing needs Supabase to persist the share and serve the Run-App.
              </p>
            )}
          </div>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button onClick={close} className="px-3 py-1.5 text-[12.5px] text-ink-dim transition hover:text-ink">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save share
          </button>
        </footer>
      </div>
    </div>
  );
}

function ShareAnalytics({ runs }: { runs: ShareRun[] }) {
  const total = runs.length;
  const ok = runs.filter((r) => r.status === "success").length;
  const cost = runs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const inputCounts: Record<string, number> = {};
  for (const r of runs) for (const k of r.inputKeys) inputCounts[k] = (inputCounts[k] ?? 0) + 1;
  const busiest = Object.entries(inputCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-2 border-t border-line/60 pt-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-faint">
        <BarChart3 size={11} /> Usage
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Runs" value={String(total)} />
        <Stat label="Success" value={`${total ? Math.round((ok / total) * 100) : 0}%`} />
        <Stat label="Cost" value={formatUsd(cost)} />
      </div>
      {busiest.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-ink-faint">
          busiest inputs:
          {busiest.map(([k, n]) => (
            <span key={k} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-dim">
              {k} ·{n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-black/20 p-1.5">
      <div className="text-[14px] font-semibold text-ink">{value}</div>
      <div className="text-[9px] text-ink-faint">{label}</div>
    </div>
  );
}

function cryptoToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return newId("tok").replace(/-/g, "");
}
