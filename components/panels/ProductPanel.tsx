"use client";

import { useState } from "react";
import { Boxes, Layers3, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { EXPLAIN_OPTIONS } from "@/lib/product/explain";
import { cn } from "@/lib/ui/cn";

/** The 6 structural Remix moves — change the shape of the system. */
const STRUCTURAL_REMIX: { id: string; label: string }[] = [
  { id: "decompose", label: "Decompose" },
  { id: "add_critic", label: "Add critic" },
  { id: "parallelize", label: "Parallelize" },
  { id: "route_models", label: "Route models" },
  { id: "add_source", label: "Add source" },
  { id: "add_checkpoint", label: "Add checkpoint" },
];

export function ProductPanel() {
  const drop = usePipelineStore((s) => s.productDrop);
  const brief = usePipelineStore((s) => s.productBrief);
  const explainText = usePipelineStore((s) => s.explainText);
  const explainAudience = usePipelineStore((s) => s.explainAudience);
  const startRemix = usePipelineStore((s) => s.startRemix);
  const explain = usePipelineStore((s) => s.explain);
  const [briefOpen, setBriefOpen] = useState(false);

  if (!drop) {
    return <p className="text-xs text-ink-faint">Open or generate a pipeline to see its Product Drop.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="rounded-2xl border border-line bg-gradient-to-b from-white/[0.05] to-transparent p-3.5">
        <div className="flex items-center gap-1.5">
          {drop.category && (
            <span className="rounded-full border border-violet/30 bg-violet/[0.08] px-2 py-0.5 text-[10px] text-violet">
              {drop.category}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[10px] text-ink-faint">
            <Sparkles size={10} /> Product Drop
          </span>
        </div>
        <h2 className="mt-2 font-display text-[22px] italic leading-tight text-ink">{drop.name}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{drop.pitch}</p>
        {drop.targetUser && (
          <p className="mt-2 text-[11px] text-ink-faint">
            <span className="text-ink-dim">For:</span> {drop.targetUser}
          </p>
        )}
        {drop.vibeTags && drop.vibeTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {drop.vibeTags.map((t) => (
              <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-ink-dim">
                {t}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Source / Brain / Surface */}
      <section className="grid grid-cols-3 gap-2">
        <SbsCol icon={Layers3} label="Source" items={drop.keySources ?? []} accent="#4f8bff" />
        <SbsCol icon={Boxes} label="Brain" items={drop.keyTeams ?? []} accent="#8b5cf6" />
        <SbsCol icon={Sparkles} label="Surface" items={drop.keySurfaces ?? []} accent="#ec4899" />
      </section>

      {/* Remix — structural moves */}
      <section>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          <Wand2 size={12} /> Remix
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STRUCTURAL_REMIX.map((a) => (
            <button
              key={a.id}
              onClick={() => startRemix(a.id)}
              className="rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink-dim transition hover:border-violet/40 hover:bg-violet/[0.08] hover:text-ink"
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* Explain */}
      <section>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          <Lightbulb size={12} /> Explain this
        </div>
        <div className="flex flex-wrap gap-1">
          {EXPLAIN_OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => explain(o.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-[10.5px] transition",
                explainAudience === o.id && explainText
                  ? "border-violet/50 bg-violet/[0.1] text-violet"
                  : "border-line bg-white/[0.02] text-ink-dim hover:text-ink",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {explainText && (
          <p className="mt-2 whitespace-pre-line rounded-lg border border-line bg-black/20 p-2.5 text-[11.5px] leading-relaxed text-ink-dim">
            {explainText}
          </p>
        )}
      </section>

      {/* Brief */}
      {brief && (
        <section className="rounded-xl border border-line bg-white/[0.02]">
          <button
            onClick={() => setBriefOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint"
          >
            Product Brief
            <span>{briefOpen ? "−" : "+"}</span>
          </button>
          {briefOpen && (
            <div className="space-y-2.5 px-3 pb-3 text-[11.5px]">
              <BriefList title="How it works" items={brief.howItWorks} />
              <BriefList title="Data needed" items={brief.dataNeeded} />
              <BriefList title="AI teams" items={brief.aiTeams} />
              <BriefList title="Missing pieces" items={brief.missingPieces} accent="text-gold" />
              <BriefList title="Next steps" items={brief.nextSteps} accent="text-violet" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SbsCol({
  icon: Icon,
  label,
  items,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  items: string[];
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide" style={{ color: accent }}>
        <Icon size={10} /> {label}
      </div>
      <ul className="mt-1 space-y-0.5">
        {(items.length ? items : ["—"]).slice(0, 4).map((i, idx) => (
          <li key={idx} className="truncate text-[10.5px] text-ink-dim" title={i}>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BriefList({ title, items, accent }: { title: string; items: string[]; accent?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{title}</div>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((i, idx) => (
          <li key={idx} className={cn("text-[11px] leading-relaxed text-ink-dim", accent)}>
            • {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
