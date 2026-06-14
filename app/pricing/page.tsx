"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { PlanCard, type PlanCardData } from "@/components/billing/PlanCard";

type Status = { planId: string; stripeConfigured: boolean; plans: PlanCardData[] };

export default function PricingPage() {
  const [s, setS] = useState<Status | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS(null));
  }, []);

  return (
    <PageShell title="Pricing" subtitle="Design, simulate, and ship AI systems. Pay for what you run.">
      <div className="max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-[12.5px] text-ink-dim">Credits are Flowmind&apos;s usage unit. Start free — upgrade when you ship.</p>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-white/[0.02] p-0.5 text-[11px]">
            {(["monthly", "yearly"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded-md px-2.5 py-1 transition ${interval === iv ? "bg-violet/15 text-violet" : "text-ink-faint hover:text-ink"}`}
              >
                {iv === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {(s?.plans ?? []).map((p) => (
            <PlanCard key={p.id} plan={p} current={p.id === s?.planId} interval={interval} stripeConfigured={Boolean(s?.stripeConfigured)} />
          ))}
          {!s && <div className="col-span-full text-[12px] text-ink-faint">Loading plans…</div>}
        </div>

        <p className="text-[11.5px] text-ink-faint">
          Need custom limits, SSO, BYOK, or self-hosting?{" "}
          <a href="mailto:sales@flowmind.app" className="text-violet hover:underline">Contact sales</a>. Manage an existing
          plan in <Link href="/settings/billing" className="text-violet hover:underline">Settings → Billing</Link>.
        </p>
      </div>
    </PageShell>
  );
}
