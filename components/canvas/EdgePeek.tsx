"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { formatCell } from "@/lib/ui/format";
import type { OutputTable } from "@/lib/pipeline/schema";

const W = 320;

/** The data peek: click an edge to see the actual value that traveled across it — naming the hop
 *  and the field. Before a run it shows the field name; after, the real table/value. */
export function EdgePeek({
  peek,
  onClose,
}: {
  peek: { edgeId: string; x: number; y: number } | null;
  onClose: () => void;
}) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const tables = usePipelineStore((s) => s.tables);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!peek) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest(".react-flow__edge")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [peek, onClose]);

  if (!peek || !pipeline) return null;
  const edge = pipeline.edges.find((e) => e.id === peek.edgeId);
  if (!edge) return null;
  const src = pipeline.nodes.find((n) => n.id === edge.source);
  const tgt = pipeline.nodes.find((n) => n.id === edge.target);
  const key = edge.dataKey || edge.label || src?.outputs[0] || "data";
  const accent = hexFor({ color: src?.color, type: src?.type });

  // The table that actually crossed this hop: prefer the edge's data key, else any table this node produced.
  const table =
    tables.find((t) => t.id === key) ??
    (src ? tables.find((t) => t.sourceNodeId === src.id) : undefined) ??
    tables.find((t) => t.id === (src?.outputs[0] ?? ""));
  const hasData = table != null && table.rows.length > 0;

  const left = Math.min(Math.max(peek.x - W / 2, 12), window.innerWidth - W - 12);
  const top = Math.min(Math.max(peek.y + 14, 12), window.innerHeight - 260);

  return (
    <div
      ref={ref}
      style={{ top, left, width: W }}
      className="fixed z-40 rounded-2xl p-3.5 glass-strong fm-fade-up shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-ink">
          <span className="truncate font-medium">{src?.title ?? edge.source}</span>
          <ArrowRight size={12} className="shrink-0 text-ink-faint" />
          <span className="truncate font-medium">{tgt?.title ?? edge.target}</span>
        </div>
        <button onClick={onClose} aria-label="Close" className="shrink-0 text-ink-faint transition hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <div className="mt-1">
        <span
          className="inline-block rounded-md px-1.5 py-[2px] font-mono text-[10.5px]"
          style={{ background: withAlpha(accent, 0.14), color: accent }}
        >
          {key}
        </span>
      </div>

      <div className="mt-3">
        {hasData ? (
          <TableValue table={table!} accent={accent} />
        ) : (
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            Run the pipeline to see the <span className="font-mono text-ink-dim">{key}</span> data that crosses here.
          </p>
        )}
      </div>
    </div>
  );
}

function TableValue({ table, accent }: { table: OutputTable; accent: string }) {
  const [showAll, setShowAll] = useState(false);
  const cols = table.columns.length
    ? table.columns
    : Object.keys(table.rows[0] ?? {}).map((k) => ({ key: k, label: k, type: "text" as const }));
  const rows = showAll ? table.rows.slice(0, 12) : table.rows.slice(0, 3);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{table.name}</span>
        <span className="font-mono text-[10px] text-ink-faint">{table.rows.length} row{table.rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-0.5">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-line bg-black/20 p-2">
            {cols.slice(0, 5).map((c) => (
              <div key={c.key} className="flex items-baseline gap-2 py-[1px]">
                <span className="w-20 shrink-0 truncate font-mono text-[10px]" style={{ color: withAlpha(accent, 0.85) }}>
                  {c.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-dim">{formatCell(row[c.key], c.type)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {table.rows.length > 3 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-1.5 text-[10.5px] font-medium text-violet">
          {showAll ? "Show less" : `Show ${Math.min(table.rows.length, 12) - 3} more`}
        </button>
      )}
    </div>
  );
}
