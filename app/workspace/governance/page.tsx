"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Download, FileClock, Loader2, Shield, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  decideApproval,
  getGovernanceConfig,
  listApprovalRequests,
  listAuditLog,
  saveGovernanceConfig,
  workspaceSpend,
} from "@/lib/governance/queries";
import { GATED_ACTIONS, GATED_ACTION_LABEL, emptyGovernance, type ApprovalRequest, type AuditEntry, type GatedAction, type GovernanceConfig } from "@/lib/governance/schema";
import { roleAtLeast } from "@/lib/workspace/schema";
import { formatUsd, timeAgo } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

export default function GovernancePage() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const loaded = useWorkspaceStore((s) => s.loaded);
  const hydrate = useWorkspaceStore((s) => s.hydrate);
  const active = useMemo(() => workspaces.find((w) => w.id === activeId), [workspaces, activeId]);

  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [spend, setSpend] = useState<{ total: number; byPipeline: { id: string; cost: number }[] }>({ total: 0, byPipeline: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) void hydrate();
  }, [loaded, hydrate]);

  const refresh = async (id: string) => {
    const [c, a, ap, sp] = await Promise.all([
      getGovernanceConfig(id),
      listAuditLog(id),
      listApprovalRequests(id),
      workspaceSpend(id),
    ]);
    setConfig(c ?? emptyGovernance(id));
    setAudit(a);
    setApprovals(ap);
    setSpend(sp);
  };
  useEffect(() => {
    // refresh is async — state is set after the fetch resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeId) void refresh(activeId);
  }, [activeId]);

  const canManage = roleAtLeast(active?.role, "admin");

  const save = async () => {
    if (!config) return;
    setSaving(true);
    await saveGovernanceConfig(config);
    setSaving(false);
  };

  const toggleGate = (a: GatedAction) => {
    if (!config) return;
    const has = config.requireApproval.includes(a);
    setConfig({ ...config, requireApproval: has ? config.requireApproval.filter((x) => x !== a) : [...config.requireApproval, a] });
  };

  const exportCsv = () => {
    const rows = [["created_at", "action", "target_type", "target_id", "summary"], ...audit.map((e) => [e.createdAt, e.action, e.targetType ?? "", e.targetId ?? "", (e.summary ?? "").replace(/"/g, "'")])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${active?.slug ?? "workspace"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded) {
    return (
      <PageShell title="Governance">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-ink-faint" size={20} />
        </div>
      </PageShell>
    );
  }
  if (!active) {
    return (
      <PageShell title="Governance">
        <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-dashed border-line p-8 text-center">
          <Shield className="mx-auto mb-3 text-ink-faint" size={20} />
          <p className="text-sm text-ink-dim">Governance applies to a workspace.</p>
          <Link href="/login" className="mx-auto mt-4 inline-block rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white">Sign in</Link>
        </div>
      </PageShell>
    );
  }

  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <PageShell title={`${active.name} · Governance`} subtitle="Audit, budgets, and approvals">
      <div className="max-w-2xl space-y-5">
        {/* Posture summary */}
        <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            <ShieldCheck size={12} className="text-green" /> Governance posture
          </h2>
          <div className="flex flex-wrap gap-2 text-[11.5px]">
            <Posture on={config?.auditEnabled ?? true} label="Audit log" />
            <Posture on={config?.monthlyBudgetUsd != null} label={config?.monthlyBudgetUsd != null ? `Budget $${config.monthlyBudgetUsd}/mo` : "No budget"} />
            <Posture on={(config?.requireApproval.length ?? 0) > 0} label={`${config?.requireApproval.length ?? 0} approval gate${(config?.requireApproval.length ?? 0) === 1 ? "" : "s"}`} />
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">An honest summary of what&apos;s enabled — no compliance certifications are claimed.</p>
        </section>

        {/* Settings */}
        {canManage && config && (
          <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Settings</h2>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-[12.5px] text-ink">
                Audit log enabled
                <Toggle on={config.auditEnabled} onClick={() => setConfig({ ...config, auditEnabled: !config.auditEnabled })} />
              </label>
              <label className="flex items-center justify-between gap-3 text-[12.5px] text-ink">
                Monthly budget (USD)
                <input
                  value={config.monthlyBudgetUsd ?? ""}
                  onChange={(e) => setConfig({ ...config, monthlyBudgetUsd: e.target.value ? Number(e.target.value.replace(/[^0-9.]/g, "")) : undefined })}
                  placeholder="none"
                  className="w-28 rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-right text-[12.5px] text-ink outline-none focus:border-line-strong"
                />
              </label>
              <div>
                <div className="mb-1.5 text-[11.5px] text-ink-dim">Require admin approval for:</div>
                <div className="space-y-1.5">
                  {GATED_ACTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-[11.5px] text-ink-dim">
                      <input type="checkbox" checked={config.requireApproval.includes(a)} onChange={() => toggleGate(a)} className="accent-violet" />
                      {GATED_ACTION_LABEL[a]}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 text-[12.5px] text-ink">
                Approval cost threshold (USD)
                <input
                  value={config.approvalCostThresholdUsd}
                  onChange={(e) => setConfig({ ...config, approvalCostThresholdUsd: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                  className="w-28 rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-right text-[12.5px] text-ink outline-none focus:border-line-strong"
                />
              </label>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save governance
              </button>
            </div>
          </section>
        )}

        {/* Spend */}
        <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Spend this month</h2>
          <div className="text-[20px] font-semibold text-ink">
            {formatUsd(spend.total)}
            {config?.monthlyBudgetUsd != null && <span className="ml-2 text-[12px] font-normal text-ink-faint">of ${config.monthlyBudgetUsd} budget</span>}
          </div>
          {spend.byPipeline.length > 0 && (
            <div className="mt-2 space-y-1">
              {spend.byPipeline.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11.5px]">
                  <span className="truncate text-ink-dim">{workspaces.find((w) => w.id === p.id)?.name ?? p.id}</span>
                  <span className="font-mono text-ink">{formatUsd(p.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending approvals */}
        {pending.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gold">Pending approvals · {pending.length}</h2>
            <div className="space-y-2">
              {pending.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/[0.05] px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-ink">{GATED_ACTION_LABEL[a.action as GatedAction] ?? a.action}</div>
                    <div className="text-[10.5px] text-ink-faint">{a.reason} · {a.estimatedCostUsd != null ? formatUsd(a.estimatedCostUsd) : ""} · {timeAgo(a.createdAt)}</div>
                  </div>
                  {canManage && (
                    <>
                      <button
                        onClick={() => void decideApproval(a.id, "approved").then(() => { if (activeId) void refresh(activeId); })}
                        className="rounded-lg bg-green/20 px-2.5 py-1 text-[11.5px] font-medium text-green"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void decideApproval(a.id, "denied").then(() => { if (activeId) void refresh(activeId); })}
                        className="rounded-lg bg-red/15 px-2.5 py-1 text-[11.5px] font-medium text-red"
                      >
                        Deny
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Audit log */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              <FileClock size={12} /> Audit log
            </h2>
            <button onClick={exportCsv} disabled={audit.length === 0} className="flex items-center gap-1 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink-dim transition hover:text-ink disabled:opacity-40">
              <Download size={11} /> CSV
            </button>
          </div>
          {audit.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[12px] text-ink-faint">No audit entries yet.</p>
          ) : (
            <div className="space-y-1">
              {audit.slice(0, 50).map((e) => (
                <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[11.5px]">
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">{e.action}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-dim">{e.summary ?? e.targetId ?? ""}</span>
                  <span className="shrink-0 text-[10px] text-ink-faint">{timeAgo(e.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Posture({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("flex items-center gap-1 rounded-full border px-2 py-1", on ? "border-green/30 bg-green/[0.06] text-green" : "border-line bg-white/[0.02] text-ink-faint")}>
      <Check size={10} className={on ? "" : "opacity-30"} /> {label}
    </span>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-violet" : "bg-white/[0.12]")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}
