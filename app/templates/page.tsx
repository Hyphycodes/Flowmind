"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Trash2, Users } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { packsWithTemplates } from "@/lib/pipeline/packs";
import type { Template } from "@/lib/pipeline/fixtures";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { ACCENT_HEX, hexFor, withAlpha, type Accent } from "@/lib/ui/colors";
import { timeAgo } from "@/lib/ui/format";
import { hasSupabase } from "@/lib/supabase/client";
import { deletePipeline, listPipelines, type PipelineSummary } from "@/lib/supabase/queries";

function readinessColor(score: number): string {
  if (score >= 75) return "#34d399";
  if (score >= 55) return "#f5c451";
  return "#fb923c";
}

function prettyComponent(s?: string): string {
  if (!s) return "—";
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export default function TemplatesPage() {
  const [saved, setSaved] = useState<PipelineSummary[]>([]);
  const packs = useMemo(() => packsWithTemplates(), []);

  useEffect(() => {
    if (hasSupabase()) listPipelines().then(setSaved);
  }, []);

  const remove = async (id: string) => {
    await deletePipeline(id);
    setSaved((s) => s.filter((p) => p.id !== id));
  };

  return (
    <PageShell title="Templates" subtitle="Start from a proven pack — open creates an editable copy">
      <div className="space-y-8">
        {packs.map((pack) => (
          <section key={pack.id}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: ACCENT_HEX[pack.accent] }} />
              <h2 className="text-[14px] font-medium text-ink">{pack.label}</h2>
              <span className="text-[12px] text-ink-faint">— {pack.purpose}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pack.templates.map((t) => (
                <TemplateCard key={t.id} template={t} accent={pack.accent} packLabel={pack.label} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {hasSupabase() && saved.length > 0 && (
        <>
          <h2 className="mb-3 mt-9 text-sm font-medium text-ink">Your pipelines</h2>
          <div className="max-w-3xl space-y-2">
            {saved.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-ink">{p.name}</div>
                  <div className="text-[11px] text-ink-faint">
                    {p.nodeCount} nodes · {timeAgo(p.updatedAt)}
                  </div>
                </div>
                <Link href={`/?open=${p.id}`} className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-dim transition hover:text-ink">
                  Open
                </Link>
                <button onClick={() => remove(p.id)} className="text-ink-faint transition hover:text-red" aria-label="Delete pipeline">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}

function TemplateCard({ template: t, accent, packLabel }: { template: Template; accent: Accent; packLabel: string }) {
  const p = t.pipeline;
  const teams = p.nodes.filter((n) => n.team);
  const agentCount = teams.reduce((s, n) => s + (n.team?.agents.length ?? 0), 0);
  const readiness = useMemo(() => calculateRealityMeter(p).buildability, [p]);
  const pitch = p.blueprint?.pitch || t.blurb;
  const previewType = prettyComponent(p.uiBindings[0]?.componentType);

  return (
    <Link
      href={`/?template=${t.id}`}
      className="group flex flex-col rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong hover:bg-white/[0.04]"
      style={{ background: `linear-gradient(180deg, ${withAlpha(ACCENT_HEX[accent], 0.05)}, rgba(255,255,255,0.02))` }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {p.nodes.slice(0, 6).map((n) => (
          <span key={n.id} className="h-2 w-2 rounded-full" style={{ background: hexFor({ color: n.color, type: n.type }) }} />
        ))}
        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: withAlpha(ACCENT_HEX[accent], 0.14), color: ACCENT_HEX[accent] }}>
          {packLabel.replace(" Pack", "")}
        </span>
      </div>
      <h3 className="text-[15px] font-medium text-ink">{t.label}</h3>
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-dim">{pitch}</p>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        <span>{p.nodes.length} nodes</span>
        {teams.length > 0 && (
          <span className="flex items-center gap-1">
            <Users size={10} /> {teams.length} team{teams.length > 1 ? "s" : ""} · {agentCount} agents
          </span>
        )}
        <span>{p.outputTables.length} tables</span>
        <span>{previewType}</span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 text-[11px]">
        <span className="flex items-center gap-1.5 text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: readinessColor(readiness) }} />
          {readiness}% ready
        </span>
        <span className="flex items-center gap-1 text-violet opacity-0 transition group-hover:opacity-100">
          Open <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
