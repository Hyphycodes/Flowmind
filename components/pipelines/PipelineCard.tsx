"use client";

import { FolderInput, Trash2 } from "lucide-react";
import type { PipelineSummary } from "@/lib/supabase/queries";
import { timeAgo } from "@/lib/ui/format";

/** Shared pipeline card used by the Pipelines index and the Command Center grid.
 *  Opens the editor on click; optional delete, optional move-to-workspace, and an optional
 *  extra footer slot (e.g. cost). */
export function PipelineCard({
  pipeline: p,
  onOpen,
  onDelete,
  onMove,
  footer,
}: {
  pipeline: PipelineSummary;
  onOpen: (id: string) => void;
  onDelete?: (e: React.MouseEvent, id: string, name: string) => void;
  onMove?: (id: string, name: string) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(p.id);
        }
      }}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong hover:bg-white/[0.04]"
    >
      {onMove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove(p.id, p.name);
          }}
          aria-label="Move to another workspace"
          title="Move to another workspace"
          className="absolute right-9 top-3 text-ink-faint opacity-0 transition hover:text-violet focus:opacity-100 group-hover:opacity-100"
        >
          <FolderInput size={15} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => onDelete(e, p.id, p.name)}
          aria-label="Delete pipeline"
          className="absolute right-3 top-3 text-ink-faint opacity-0 transition hover:text-red focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      )}

      <h3 className="truncate pr-6 text-[15px] font-medium text-ink">{p.name}</h3>
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-dim">{p.description || "No description"}</p>
      <div className="mt-3 flex items-center gap-x-2 border-t border-line/60 pt-2.5 text-[11px] text-ink-faint">
        <span>
          {p.nodeCount} node{p.nodeCount === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span>{timeAgo(p.updatedAt)}</span>
        {footer ? <span className="ml-auto">{footer}</span> : null}
      </div>
    </div>
  );
}
