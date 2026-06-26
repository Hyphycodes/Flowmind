"use client";

import { Check, FolderInput, Trash2 } from "lucide-react";
import type { PipelineSummary } from "@/lib/supabase/queries";
import { timeAgo } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

/** Shared pipeline card used by the Pipelines index and the Command Center grid.
 *  Opens the editor on click; optional delete, optional move-to-workspace, and an optional
 *  extra footer slot (e.g. cost). In selection mode the card toggles a checkbox instead. */
export function PipelineCard({
  pipeline: p,
  onOpen,
  onDelete,
  onMove,
  footer,
  selectable,
  selected,
  onToggleSelect,
}: {
  pipeline: PipelineSummary;
  onOpen: (id: string) => void;
  onDelete?: (e: React.MouseEvent, id: string, name: string) => void;
  onMove?: (id: string, name: string) => void;
  footer?: React.ReactNode;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const activate = () => (selectable ? onToggleSelect?.(p.id) : onOpen(p.id));
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-2xl border bg-white/[0.02] p-4 transition hover:bg-white/[0.04]",
        selected ? "border-violet/70 bg-violet/[0.06]" : "border-line hover:border-line-strong",
      )}
    >
      {selectable && (
        <span
          className={cn(
            "absolute left-3 top-3 flex h-4 w-4 items-center justify-center rounded border transition",
            selected ? "border-violet bg-violet text-white" : "border-line-strong bg-black/30 text-transparent",
          )}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      {onMove && !selectable && (
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
      {onDelete && !selectable && (
        <button
          onClick={(e) => onDelete(e, p.id, p.name)}
          aria-label="Delete pipeline"
          className="absolute right-3 top-3 text-ink-faint opacity-0 transition hover:text-red focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </button>
      )}

      <h3 className={cn("truncate pr-6 text-[15px] font-medium text-ink", selectable && "pl-6")}>{p.name}</h3>
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
