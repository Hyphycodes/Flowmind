"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ProviderStatus } from "@/components/models/ProviderStatus";
import { ToolRegistry } from "@/components/tools/ToolRegistry";
import { ConnectedAccounts } from "@/components/auth/ConnectedAccounts";
import { GitHubConnection } from "@/components/github/GitHubConnection";

type Status = { anthropic: boolean; model: string; supabase: boolean };

export default function SettingsPage() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ anthropic: false, model: "", supabase: false }));
  }, []);

  return (
    <PageShell title="Settings">
      <div className="max-w-2xl space-y-5">
        <Card title="Environment">
          <StatusRow label="Anthropic API key" ok={!!s?.anthropic} okText="Connected" badText="Not set" />
          <Row label="Model" value={s?.model || "—"} />
          <StatusRow label="Supabase" ok={!!s?.supabase} okText="Connected" badText="Local only" />
        </Card>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Plan &amp; billing</h2>
            <Link href="/settings/billing" className="text-[11px] text-violet hover:underline">Billing →</Link>
          </div>
          <Link
            href="/settings/billing"
            className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] p-3.5 transition hover:bg-white/[0.04]"
          >
            <span className="text-[13px] text-ink">Plans, credits, and usage</span>
            <span className="text-[12px] text-violet">Manage →</span>
          </Link>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Connected accounts</h2>
            <Link href="/account" className="text-[11px] text-violet hover:underline">Account →</Link>
          </div>
          <div className="space-y-2.5">
            <ConnectedAccounts />
            <GitHubConnection />
          </div>
        </section>

        <ProviderStatus />
        <ToolRegistry />

        {s && !s.anthropic && (
          <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-4 text-[12.5px] leading-relaxed text-ink-dim">
            Generation and runs use real Claude. Add{" "}
            <code className="rounded bg-white/10 px-1 font-mono text-[11px]">ANTHROPIC_API_KEY</code> to{" "}
            <code className="rounded bg-white/10 px-1 font-mono text-[11px]">.env.local</code> (and your
            Vercel project), then restart the dev server.
          </div>
        )}

        <Card title="Security">
          <p className="text-[12.5px] leading-relaxed text-ink-dim">
            Row-level security is currently permissive (single-user prototype, no auth). Tighten the
            Supabase RLS policies in <code className="font-mono text-[11px]">supabase/migrations</code>{" "}
            before exposing this publicly.
          </p>
        </Card>

        <Card title="About">
          <Row label="App" value="Flowmind" />
          <Row label="Build" value="V1 — visual AI agent pipeline builder" />
        </Card>
      </div>
    </PageShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-dim">{label}</span>
      <span className="font-mono text-[12px] text-ink">{value}</span>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-ink-dim">{label}</span>
      <span className={`flex items-center gap-1.5 text-[12px] ${ok ? "text-green" : "text-ink-faint"}`}>
        {ok ? <Check size={13} /> : <X size={13} />}
        {ok ? okText : badText}
      </span>
    </div>
  );
}
