import { getBillingAccount } from "@/lib/billing/usage";

export const runtime = "nodejs";

/** Compact usage-meter payload for the sidebar + settings. No secrets. */
export async function GET() {
  const a = await getBillingAccount();
  const lim = a.plan.limits;
  return Response.json({
    billingEnabled: a.billingEnabled,
    planId: a.planId,
    planName: a.plan.name,
    creditsRemaining: Math.round(a.balance.balance),
    includedCredits: a.plan.includedCredits,
    realRuns: { used: a.counters.realRuns ?? 0, limit: lim.realRunsPerMonth },
    edits: { used: a.counters.edits ?? 0, limit: lim.editsPerMonth },
    exports: { used: a.counters.exports ?? 0, limit: lim.exportsPerMonth },
    githubPrExports: { used: a.counters.githubPrExports ?? 0, limit: lim.githubPrExportsPerMonth },
    inputStudioRows: { used: a.counters.inputStudioRows ?? 0, limit: lim.inputStudioRowsPerMonth },
    periodEnd: a.periodEnd,
  });
}
