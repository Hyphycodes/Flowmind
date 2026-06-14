"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type PlanCardData = {
  id: string;
  name: string;
  description: string;
  monthlyPriceCents?: number;
  yearlyPriceCents?: number;
  includedCredits: number;
  features: string[];
  purchasable: boolean;
};

const FEATURE_LABEL: Record<string, string> = {
  templates: "Templates",
  real_ai_runs: "Real AI runs",
  input_studio: "Input Studio",
  developer_export: "Developer export",
  client_blueprint: "Client blueprint export",
  founder_brief: "Founder brief export",
  github_pr_export: "GitHub PR export",
  google_drive_connector: "Google Drive connector",
  team_workspace: "Team workspace",
  branded_exports: "Branded exports",
  private_template_library: "Private template library",
  byok: "Bring your own keys",
  advanced_evals: "Advanced evals",
  priority_support: "Priority support",
  self_hosting: "Self-hosting",
};

function price(cents?: number): string {
  if (cents == null) return "Custom";
  if (cents === 0) return "Free";
  return `$${Math.round(cents / 100)}`;
}

/** A single plan column. The CTA self-disables with a clear message when checkout isn't wired. */
export function PlanCard({
  plan,
  current,
  interval,
  stripeConfigured,
}: {
  plan: PlanCardData;
  current: boolean;
  interval: "monthly" | "yearly";
  stripeConfigured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isEnterprise = plan.id === "enterprise";
  const isFree = plan.id === "free";
  const cents = interval === "yearly" ? plan.yearlyPriceCents : plan.monthlyPriceCents;

  const subscribe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, interval }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setMsg(data.message ?? data.error ?? "Checkout unavailable.");
    } catch {
      setMsg("Checkout failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col rounded-2xl border p-4", current ? "border-violet/50 bg-violet/[0.05]" : "border-line bg-white/[0.02]")}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-ink">{plan.name}</span>
        {current && <span className="rounded-full bg-violet/15 px-2 py-0.5 text-[10px] font-medium text-violet">Current</span>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[22px] font-semibold text-ink">{price(cents)}</span>
        {!isFree && !isEnterprise && cents != null && <span className="text-[11px] text-ink-faint">/{interval === "yearly" ? "yr" : "mo"}</span>}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">{plan.description}</p>
      <div className="mt-2 text-[11px] text-ink-faint">{plan.includedCredits.toLocaleString()} credits / month</div>

      <ul className="mt-3 flex-1 space-y-1.5">
        {plan.features.slice(0, 7).map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[11.5px] text-ink-dim">
            <Check size={12} className="mt-0.5 shrink-0 text-green" /> {FEATURE_LABEL[f] ?? f}
          </li>
        ))}
      </ul>

      <div className="mt-3.5">
        {current ? (
          <button disabled className="w-full rounded-lg border border-line bg-white/[0.02] py-1.5 text-[12px] text-ink-faint">
            Your plan
          </button>
        ) : isEnterprise ? (
          <a
            href="mailto:sales@flowmind.app?subject=Flowmind%20Enterprise"
            className="block w-full rounded-lg border border-line-strong bg-white/[0.04] py-1.5 text-center text-[12px] text-ink transition hover:bg-white/[0.09]"
          >
            Contact sales
          </a>
        ) : isFree ? (
          <button disabled className="w-full rounded-lg border border-line bg-white/[0.02] py-1.5 text-[12px] text-ink-faint">
            Included
          </button>
        ) : (
          <button
            onClick={() => void subscribe()}
            disabled={busy || !plan.purchasable || !stripeConfigured}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            {plan.purchasable && stripeConfigured ? `Choose ${plan.name}` : "Setup required"}
          </button>
        )}
        {msg && <p className="mt-1.5 text-[10.5px] text-gold">{msg}</p>}
        {!stripeConfigured && !isFree && !isEnterprise && !current && (
          <p className="mt-1.5 text-[10px] text-ink-faint">Set STRIPE_SECRET_KEY + price IDs to enable checkout.</p>
        )}
      </div>
    </div>
  );
}
