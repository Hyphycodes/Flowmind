"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Shield, Trash2, UserPlus } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { WorkspacePresence } from "@/components/workspace/WorkspacePresence";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { inviteMember, listMembers, removeMember, updateMemberRole } from "@/lib/workspace/queries";
import { ROLE_COPY, WORKSPACE_ROLES, roleAtLeast, type Membership, type WorkspaceRole } from "@/lib/workspace/schema";
import { timeAgo } from "@/lib/ui/format";

export default function WorkspaceSettingsPage() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const loaded = useWorkspaceStore((s) => s.loaded);
  const hydrate = useWorkspaceStore((s) => s.hydrate);

  const active = useMemo(() => workspaces.find((w) => w.id === activeId), [workspaces, activeId]);
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) void hydrate();
  }, [loaded, hydrate]);

  const refresh = () => {
    if (activeId) void listMembers(activeId).then(setMembers);
  };
  useEffect(() => {
    if (activeId) void listMembers(activeId).then(setMembers);
  }, [activeId]);

  const canManage = roleAtLeast(active?.role, "admin");

  const invite = async () => {
    if (!activeId || !email.trim()) return;
    setBusy(true);
    await inviteMember(activeId, email, role);
    setEmail("");
    refresh();
    setBusy(false);
  };

  if (!loaded) {
    return (
      <PageShell title="Workspace">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-ink-faint" size={20} />
        </div>
      </PageShell>
    );
  }

  if (!active) {
    return (
      <PageShell title="Workspace">
        <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-dashed border-line p-8 text-center">
          <Shield className="mx-auto mb-3 text-ink-faint" size={20} />
          <p className="text-sm text-ink-dim">No workspace yet.</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">
            Workspaces let a team share pipelines, runs, and libraries with roles. Sign in and create one from the
            sidebar switcher.
          </p>
          <Link href="/login" className="mx-auto mt-4 inline-block rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white">
            Sign in
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={active.name} subtitle="Members & roles">
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white/[0.02] p-4">
          <div>
            <div className="text-[13px] font-medium text-ink">{active.name}</div>
            <div className="text-[11.5px] text-ink-faint">Your role: {active.role ?? "member"}</div>
          </div>
          <WorkspacePresence channel={`presence:ws:${active.id}`} />
        </div>

        {canManage && (
          <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              <UserPlus size={12} /> Invite a member
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="rounded-lg border border-line bg-black/30 px-2.5 py-2 text-[12.5px] text-ink outline-none"
              >
                {WORKSPACE_ROLES.filter((r) => r !== "owner").map((r) => (
                  <option key={r} value={r} className="bg-[#14141c] capitalize">
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={invite}
                disabled={busy || !email.trim()}
                className="rounded-lg bg-violet px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
              >
                Invite
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">{ROLE_COPY[role]}</p>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Members {members ? `· ${members.length}` : ""}
          </h2>
          {members === null ? (
            <div className="py-6 text-center text-[12px] text-ink-faint">Loading…</div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-xs font-semibold text-white">
                    {(m.invitedEmail ?? m.email ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] text-ink">{m.email ?? m.invitedEmail ?? m.userId ?? "Member"}</div>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-ink-faint">
                      {m.status === "invited" && (
                        <span className="flex items-center gap-1 text-gold">
                          <Mail size={9} /> invited
                        </span>
                      )}
                      <span>· joined {timeAgo(m.createdAt)}</span>
                    </div>
                  </div>
                  {canManage && m.role !== "owner" ? (
                    <select
                      value={m.role}
                      onChange={(e) => void updateMemberRole(m.id, e.target.value as WorkspaceRole).then(refresh)}
                      className="rounded-lg border border-line bg-black/30 px-2 py-1 text-[11.5px] capitalize text-ink-dim outline-none"
                    >
                      {WORKSPACE_ROLES.map((r) => (
                        <option key={r} value={r} className="bg-[#14141c] capitalize">
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] capitalize text-ink-faint">{m.role}</span>
                  )}
                  {canManage && m.role !== "owner" && (
                    <button onClick={() => void removeMember(m.id).then(refresh)} aria-label="Remove" className="text-ink-faint transition hover:text-red">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
