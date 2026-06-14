"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Loader2, Zap } from "lucide-react";
import { PlanCard, type PlanCardData } from "./PlanCard";

type LimitVal = number | "unlimited";

type Status = {
  billingEnabled: boolean;
  stripeConfigured: boolean;
  planId: string;
  plan: { name: string };
  status: string;
  cancelAtPeriodEnd: boolean;
  balance: { balance: number; monthlyGrantRemaining: number; purchasedCreditsRemaining: number };
  counters: Record<string, number>;
  periodEnd: string;
  plans: PlanCardData[];
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function counterLine(used: number, limit: LimitVal): string {
  return limit === "unlimited" ? `${used}` : `${used} / ${limit}`;
}

/** Settings → Billing: current plan, usage, plans, manage payment. Compact + calm. */
export function BillingSettings() {
  const [s, setS] = useState<Status | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS(null));
  }, []);

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
    } finally {
      setPortalBusy(false);
    }
  };

  if (!s) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-ink-faint">
        <Loader2 size={13} className="animate-spin" /> Loading billing…
      </div>
    );
  }

  const planMeta = s.plans.find((p) => p.id === s.planId);
  const limits = (planMeta as unknown as { limits?: Record<string, LimitVal> })?.limits ?? {};

  return (
    <div className="space-y-5">
      {!s.billingEnabled && (
        <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-3.5 text-[12px] leading-relaxed text-ink-dim">
          Billing is in preview mode (<code className="font-mono text-[11px]">NEXT_PUBLIC_BILLING_ENABLED</code> is off). Plans
          and usage are shown for reference; nothing is charged and limits aren&apos;t enforced.
        </div>
      )}

      {/* Current plan + usage */}
      <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-ink">{s.plan.name} Plan</div>
            <div className="text-[11.5px] text-ink-faint">
              {s.status === "none" ? "No active subscription" : `Status: ${s.status}`}
              {s.cancelAtPeriodEnd ? " · cancels at period end" : ""} · Resets {fmtDate(s.periodEnd)}
            </div>
          </div>
          <button
            onClick={() => void openPortal()}
            disabled={portalBusy || !s.stripeConfigured}
            className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-ink transition hover:bg-white/[0.09] disabled:opacity-50"
          >
            {portalBusy ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />} Manage billing
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={<Zap size={12} className="text-gold" />} label="Credits left" value={Math.round(s.balance.balance).toLocaleString()} />
          <Stat label="Runs" value={counterLine(s.counters.realRuns ?? 0, limits.realRunsPerMonth ?? "unlimited")} />
          <Stat label="Exports" value={counterLine(s.counters.exports ?? 0, limits.exportsPerMonth ?? "unlimited")} />
          <Stat label="GitHub PRs" value={counterLine(s.counters.githubPrExports ?? 0, limits.githubPrExportsPerMonth ?? "unlimited")} />
        </div>
      </section>

      {/* Plans */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Plans</h2>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-white/[0.02] p-0.5 text-[11px]">
            {(["monthly", "yearly"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`rounded-md px-2 py-1 transition ${interval === iv ? "bg-violet/15 text-violet" : "text-ink-faint hover:text-ink"}`}
              >
                {iv === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {s.plans.map((p) => (
            <PlanCard key={p.id} plan={p} current={p.id === s.planId} interval={interval} stripeConfigured={s.stripeConfigured} />
          ))}
        </div>
      </section>

      <p className="flex items-center gap-1 text-[11px] text-ink-faint">
        Credits are Flowmind&apos;s usage unit — we never show exact provider prices. Payments are handled securely by Stripe
        <ExternalLink size={10} />.
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wide text-ink-faint">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold text-ink">{value}</div>
    </div>
  );
}
