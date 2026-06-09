"use client";

import { useState } from "react";
import { ChevronRight, Table2 } from "lucide-react";
import type { OutputTable, UIBinding } from "@/lib/pipeline/schema";
import { cn } from "@/lib/ui/cn";
import { TableView } from "./TableView";

export function TableList({
  tables,
  bindings,
}: {
  tables: OutputTable[];
  bindings: UIBinding[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const boundIds = new Set(bindings.map((b) => b.tableId));

  if (tables.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
        No output tables yet. Generate or run a pipeline to populate them.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {tables.map((t) => {
        const isOpen = open === t.id;
        return (
          <div key={t.id} className="overflow-hidden rounded-xl border border-line bg-white/[0.02]">
            <button
              onClick={() => setOpen(isOpen ? null : t.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
            >
              <Table2 size={15} className="text-ink-faint" />
              <span className="flex-1 truncate font-mono text-[12px] text-ink">{t.name}</span>
              {boundIds.has(t.id) && (
                <span
                  className="rounded bg-violet/15 px-1.5 py-0.5 text-[9px] font-medium text-violet"
                  title="connected to UI preview"
                >
                  UI
                </span>
              )}
              <span className="text-[11px] text-ink-faint">
                {t.rows.length} {t.rows.length === 1 ? "row" : "rows"}
              </span>
              <ChevronRight size={14} className={cn("text-ink-faint transition", isOpen && "rotate-90")} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                {t.columns.length ? (
                  <TableView table={t} />
                ) : (
                  <p className="text-[11px] text-ink-faint">Run the pipeline to populate this table.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
