import { getBillingAccount } from "@/lib/billing/usage";
import { PLANS, PLAN_ORDER } from "@/lib/billing/plans";

export const runtime = "nodejs";

/** Sanitized billing status: plan, balance, counters, features, available plans. No secrets. */
export async function GET() {
  const account = await getBillingAccount();
  return Response.json({
    billingEnabled: account.billingEnabled,
    stripeConfigured: account.stripeConfigured,
    planId: account.planId,
    plan: { id: account.plan.id, name: account.plan.name, description: account.plan.description, features: account.plan.features, limits: account.plan.limits },
    status: account.status,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd ?? false,
    balance: account.balance,
    counters: account.counters,
    periodStart: account.periodStart,
    periodEnd: account.periodEnd,
    plans: PLAN_ORDER.map((id) => {
      const p = PLANS[id];
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        monthlyPriceCents: p.monthlyPriceCents,
        yearlyPriceCents: p.yearlyPriceCents,
        includedCredits: p.includedCredits,
        features: p.features,
        limits: p.limits,
        purchasable: Boolean(p.stripePriceIdMonthly),
      };
    }),
  });
}
