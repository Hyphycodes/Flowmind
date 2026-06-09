"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Layers, Library, Play, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const NAV = [
  { href: "/", label: "Pipelines", icon: Layers },
  { href: "/templates", label: "Templates", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/runs", label: "Runs", icon: Play },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNewPipeline }: { onNewPipeline?: () => void }) {
  const path = usePathname();
  const router = useRouter();

  return (
    <aside className="z-20 flex h-full w-[244px] shrink-0 flex-col border-r border-line bg-[#09090f]/80 px-4 py-5 backdrop-blur-xl">
      <Link href="/" className="px-2 font-display text-[26px] italic leading-none tracking-tight text-ink">
        flowmind
      </Link>

      <button
        type="button"
        onClick={() => (onNewPipeline ? onNewPipeline() : router.push("/?new=1"))}
        className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.04] py-2.5 text-sm font-medium text-ink transition hover:bg-white/[0.09]"
      >
        <Plus size={16} /> New Pipeline
      </button>

      <nav className="mt-6 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition",
                active ? "bg-white/[0.08] text-ink" : "text-ink-dim hover:bg-white/[0.04] hover:text-ink",
              )}
            >
              <Icon size={16} strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <UsageCard />
        <ProfileCard />
      </div>
    </aside>
  );
}

function UsageCard() {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink">Pro Plan</span>
        <Link href="/settings" className="text-[11px] text-violet hover:underline">
          Upgrade
        </Link>
      </div>
      <div className="mt-3 space-y-2.5">
        <Meter label="Pipelines" value="12 / 25" pct={48} accent="#8b5cf6" />
        <Meter label="Runs" value="423 / 1000" pct={42} accent="#4f8bff" />
        <Meter label="Storage" value="8.4 / 50 GB" pct={17} accent="#2dd4bf" />
      </div>
    </div>
  );
}

function Meter({ label, value, pct, accent }: { label: string; value: string; pct: number; accent: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-dim">{label}</span>
        <span className="text-ink-faint">{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

function ProfileCard() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] p-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-xs font-semibold text-white">
        F
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-ink">You</div>
        <div className="truncate text-[11px] text-ink-faint">Flowmind workspace</div>
      </div>
    </div>
  );
}
