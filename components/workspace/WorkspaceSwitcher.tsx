"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cn } from "@/lib/ui/cn";

/** Sidebar workspace switcher (Task 07). Hidden in the public demo (no auth → no workspaces).
 *  Switching only changes the active filter; RLS membership is the real access boundary. */
export function WorkspaceSwitcher() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const loaded = useWorkspaceStore((s) => s.loaded);
  const hydrate = useWorkspaceStore((s) => s.hydrate);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const createWs = useWorkspaceStore((s) => s.create);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loaded) void hydrate();
  }, [loaded, hydrate]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // No workspaces (public demo / not signed in) → nothing to switch.
  if (!loaded || workspaces.length === 0) return null;
  const active = workspaces.find((w) => w.id === activeId);

  return (
    <div ref={ref} className="relative mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet/15 text-violet">
          <Building2 size={13} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{active?.name ?? "Workspace"}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl p-1.5 glass-strong shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                setActive(w.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition",
                w.id === activeId ? "bg-white/[0.08] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.role && <span className="shrink-0 text-[9.5px] text-ink-faint">{w.role}</span>}
              {w.id === activeId && <Check size={12} className="shrink-0 text-violet" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link
            href="/workspace/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-dim transition hover:text-ink"
          >
            <Settings2 size={12} /> Members & settings
          </Link>
          <button
            onClick={async () => {
              const name = window.prompt("New workspace name");
              if (name?.trim()) await createWs(name.trim());
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-dim transition hover:text-ink"
          >
            <Plus size={12} /> New workspace
          </button>
        </div>
      )}
    </div>
  );
}
