"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { TEMPLATES } from "@/lib/pipeline/fixtures";
import { hexFor } from "@/lib/ui/colors";
import { timeAgo } from "@/lib/ui/format";
import { hasSupabase } from "@/lib/supabase/client";
import { deletePipeline, listPipelines, type PipelineSummary } from "@/lib/supabase/queries";

export default function TemplatesPage() {
  const [saved, setSaved] = useState<PipelineSummary[]>([]);

  useEffect(() => {
    if (hasSupabase()) listPipelines().then(setSaved);
  }, []);

  const remove = async (id: string) => {
    await deletePipeline(id);
    setSaved((s) => s.filter((p) => p.id !== id));
  };

  return (
    <PageShell title="Templates" subtitle="Start from a proven pipeline">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/?template=${t.id}`}
            className="group rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong hover:bg-white/[0.04]"
          >
            <div className="mb-3 flex gap-1.5">
              {t.pipeline.nodes.slice(0, 6).map((n) => (
                <span
                  key={n.id}
                  className="h-2 w-2 rounded-full"
                  style={{ background: hexFor({ color: n.color, type: n.type }) }}
                />
              ))}
            </div>
            <h3 className="text-[15px] font-medium text-ink">{t.label}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{t.blurb}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
              <span>
                {t.pipeline.nodes.length} nodes · {t.pipeline.outputTables.length} tables
              </span>
              <span className="flex items-center gap-1 text-violet opacity-0 transition group-hover:opacity-100">
                Open <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {hasSupabase() && saved.length > 0 && (
        <>
          <h2 className="mb-3 mt-9 text-sm font-medium text-ink">Your pipelines</h2>
          <div className="max-w-3xl space-y-2">
            {saved.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-ink">{p.name}</div>
                  <div className="text-[11px] text-ink-faint">
                    {p.nodeCount} nodes · {timeAgo(p.updatedAt)}
                  </div>
                </div>
                <Link
                  href={`/?open=${p.id}`}
                  className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-dim transition hover:text-ink"
                >
                  Open
                </Link>
                <button
                  onClick={() => remove(p.id)}
                  className="text-ink-faint transition hover:text-red"
                  aria-label="Delete pipeline"
                >
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
