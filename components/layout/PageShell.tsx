"use client";

import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: top bar + drawer (below md). Desktop: persistent header. */}
        <MobileNav title={title} />
        <header className="hidden h-14 shrink-0 items-center border-b border-line px-6 md:flex">
          <h1 className="font-display text-xl italic text-ink">{title}</h1>
          {subtitle ? <span className="ml-3 text-sm text-ink-faint">{subtitle}</span> : null}
        </header>
        <div className="flow-canvas min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
