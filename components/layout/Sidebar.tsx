"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Layers, Library, LogIn, Play, Plus, Settings } from "lucide-react";
import { UsageMeter } from "@/components/billing/UsageMeter";
import { cn } from "@/lib/ui/cn";

const NAV = [
  { href: "/pipelines", label: "Pipelines", icon: Layers },
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
        <UsageMeter />
        <ProfileCard />
      </div>
    </aside>
  );
}

type Session = {
  authEnabled: boolean;
  user: { email?: string | null; displayName?: string | null; avatarUrl?: string | null } | null;
};

function ProfileCard() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ authEnabled: false, user: null }));
  }, []);

  const user = session?.user;
  const enabled = session?.authEnabled;

  // Signed in
  if (user) {
    const name = user.displayName ?? user.email ?? "You";
    return (
      <Link href="/account" className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] p-2.5 transition hover:bg-white/[0.04]">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-xs font-semibold text-white">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-ink">{name}</div>
          <div className="truncate text-[11px] text-ink-faint">{user.email ?? "Account"}</div>
        </div>
      </Link>
    );
  }

  // Auth enabled but not signed in
  if (enabled) {
    return (
      <Link href="/login" className="flex items-center gap-2 rounded-xl border border-line-strong bg-white/[0.04] p-2.5 text-[13px] font-medium text-ink transition hover:bg-white/[0.09]">
        <LogIn size={15} /> Sign in
      </Link>
    );
  }

  // Demo mode
  return (
    <Link href="/account" className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] p-2.5 transition hover:bg-white/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-xs font-semibold text-white">F</div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium text-ink">Demo</div>
        <div className="truncate text-[11px] text-ink-faint">Flowmind workspace</div>
      </div>
    </Link>
  );
}
