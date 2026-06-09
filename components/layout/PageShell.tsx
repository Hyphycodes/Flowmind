"use client";

import { Sidebar } from "./Sidebar";

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
        <header className="flex h-14 shrink-0 items-center border-b border-line px-6">
          <h1 className="font-display text-xl italic text-ink">{title}</h1>
          {subtitle ? <span className="ml-3 text-sm text-ink-faint">{subtitle}</span> : null}
        </header>
        <div className="flow-canvas min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
