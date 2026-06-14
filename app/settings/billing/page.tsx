import { PageShell } from "@/components/layout/PageShell";
import { BillingSettings } from "@/components/billing/BillingSettings";
import { KeyRound } from "lucide-react";

export default function BillingPage() {
  return (
    <PageShell title="Billing" subtitle="Plan, credits, usage, and payment">
      <div className="max-w-4xl space-y-5">
        <BillingSettings />

        {/* BYOK — architecture in place; flow opens on Enterprise. We never ask for a real key
            until per-provider encryption is wired (tokens are encrypted server-side, never exported). */}
        <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound size={15} className="text-ink-dim" />
            <h2 className="text-[13px] font-medium text-ink">Model Keys (BYOK)</h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-faint">Enterprise</span>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-dim">
            Bring your own model-provider keys to route runs through your own account. Keys are
            encrypted server-side and never sent to the client or included in exports. This is part of
            the Enterprise plan — see <code className="font-mono text-[11px]">docs/CREDITS_AND_USAGE.md</code>.
          </p>
          <button
            disabled
            className="mt-2.5 cursor-not-allowed rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-ink-faint"
          >
            Add provider key — coming soon
          </button>
        </section>
      </div>
    </PageShell>
  );
}
