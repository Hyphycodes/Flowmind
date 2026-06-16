"use client";

import { useState } from "react";
import { Check, ChevronDown, GitPullRequestArrow, Minus, Pencil, Plus, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import type { EditDiff } from "@/lib/pipeline/editDiff";
import { cn } from "@/lib/ui/cn";

/** The checkmark-approval proposal. Each change is a checkable row; depends_on gates children until
 *  their parent is checked. Apply selected / Apply all / Discard. The canvas shows a ghost preview
 *  of the checked subset (see PipelineCanvas). Nothing mutates until applied. */
export function DiffProposalPanel() {
  const proposal = usePipelineStore((s) => s.editProposal);
  const checked = usePipelineStore((s) => s.editChecked);
  const toggle = usePipelineStore((s) => s.toggleEditChange);
  const apply = usePipelineStore((s) => s.applyEditProposal);
  const discard = usePipelineStore((s) => s.discardEditProposal);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!proposal) return null;
  const effectiveChecked = (id: string) => {
    const c = proposal.changes.find((x) => x.id === id);
    if (!c) return false;
    return Boolean(checked[id]) && c.depends_on.every((d) => checked[d]);
  };
  const checkedCount = proposal.changes.filter((c) => effectiveChecked(c.id)).length;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-[84px] z-30 mx-auto w-full max-w-2xl px-4">
      <div className="overflow-hidden rounded-2xl glass-strong shadow-[0_16px_48px_rgba(0,0,0,0.55)] fm-fade-up">
        <header className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
            <GitPullRequestArrow size={14} className="text-violet" />
            Proposed changes
            <span className="text-ink-faint">· {proposal.changes.length}</span>
          </span>
          <button onClick={discard} aria-label="Discard" className="text-ink-faint transition hover:text-ink">
            <X size={15} />
          </button>
        </header>

        <div className="max-h-[42vh] divide-y divide-line/60 overflow-y-auto">
          {proposal.changes.map((c) => {
            const parentUnmet = c.depends_on.some((d) => !checked[d]);
            const isChecked = Boolean(checked[c.id]) && !parentUnmet;
            const open = expanded === c.id;
            return (
              <div key={c.id} className="px-3.5 py-2.5">
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => !parentUnmet && toggle(c.id)}
                    disabled={parentUnmet}
                    aria-label={isChecked ? "Uncheck" : "Check"}
                    className={cn(
                      "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition",
                      isChecked ? "border-violet bg-violet text-white" : "border-line-strong text-transparent",
                      parentUnmet && "opacity-40",
                    )}
                  >
                    <Check size={12} strokeWidth={3} />
                  </button>
                  <button type="button" onClick={() => setExpanded(open ? null : c.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <DiffBadges diff={c.diff} />
                      <span className="truncate text-[13px] text-ink">{c.summary}</span>
                    </div>
                    {parentUnmet && <span className="text-[10px] text-ink-faint">check the change it depends on first</span>}
                    {open && c.why && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">{c.why}</p>}
                  </button>
                  <ChevronDown
                    size={14}
                    onClick={() => setExpanded(open ? null : c.id)}
                    className={cn("mt-1 shrink-0 cursor-pointer text-ink-faint transition", open && "rotate-180")}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-3.5 py-2.5">
          <button
            onClick={() => apply("selected")}
            disabled={checkedCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-40"
          >
            <Check size={13} /> Apply selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
          </button>
          <button
            onClick={() => apply("all")}
            className="rounded-lg border border-line-strong bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-ink transition hover:bg-white/[0.1]"
          >
            Apply all
          </button>
          <button onClick={discard} className="ml-auto px-2 py-1.5 text-[12.5px] text-ink-faint transition hover:text-ink">
            Discard
          </button>
        </footer>
      </div>
    </div>
  );
}

function DiffBadges({ diff }: { diff: EditDiff }) {
  const adds = diff.add_nodes.length;
  const removes = diff.remove_nodes.length;
  const mods = diff.modify_nodes.length;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {adds > 0 && <Badge icon={Plus} n={adds} color="#34d399" />}
      {removes > 0 && <Badge icon={Minus} n={removes} color="#f87171" />}
      {mods > 0 && <Badge icon={Pencil} n={mods} color="#f5c451" />}
    </span>
  );
}

function Badge({ icon: Icon, n, color }: { icon: typeof Plus; n: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5 rounded px-1 py-[1px] text-[9.5px] font-medium tabular-nums" style={{ color, background: `${color}1f` }}>
      <Icon size={9} strokeWidth={3} />
      {n}
    </span>
  );
}
