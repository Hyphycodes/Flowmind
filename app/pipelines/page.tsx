"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { hasSupabase } from "@/lib/supabase/client";
import { deletePipeline, listPipelines, type PipelineSummary } from "@/lib/supabase/queries";
import { timeAgo } from "@/lib/ui/format";

export default function PipelinesPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineSummary[] | null>(null);

  useEffect(() => {
    Promise.resolve(hasSupabase() ? listPipelines() : []).then(setPipelines);
  }, []);

  const remove = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const ok = await deletePipeline(id);
    if (ok) setPipelines((s) => (s ? s.filter((p) => p.id !== id) : s));
  };

  const open = (id: string) => router.push(`/?open=${id}`);

  return (
    <PageShell title="Pipelines" subtitle="Your pipelines">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[12.5px] text-ink-faint">
          {pipelines === null ? "" : `${pipelines.length} pipeline${pipelines.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={() => router.push("/?new=1")}
          className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
        >
          <Plus size={15} /> New pipeline
        </button>
      </div>

      {pipelines === null ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-ink-faint" size={20} />
        </div>
      ) : pipelines.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-dashed border-line p-8 text-center">
          <Layers className="mx-auto mb-3 text-ink-faint" size={20} />
          <p className="text-sm text-ink-dim">No pipelines yet.</p>
          <p className="mt-1 text-xs text-ink-faint">Generate one from the editor to see it here.</p>
          <button
            onClick={() => router.push("/?new=1")}
            className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
          >
            <Plus size={15} /> New pipeline
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pipelines.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => open(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(p.id);
                }
              }}
              className="group relative flex cursor-pointer flex-col rounded-2xl border border-line bg-white/[0.02] p-4 transition hover:border-line-strong hover:bg-white/[0.04]"
            >
              <button
                onClick={(e) => remove(e, p.id, p.name)}
                aria-label="Delete pipeline"
                className="absolute right-3 top-3 text-ink-faint opacity-0 transition hover:text-red focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>

              <h3 className="truncate pr-6 text-[15px] font-medium text-ink">{p.name}</h3>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-dim">
                {p.description || "No description"}
              </p>
              <div className="mt-3 flex items-center gap-x-2 border-t border-line/60 pt-2.5 text-[11px] text-ink-faint">
                <span>
                  {p.nodeCount} node{p.nodeCount === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>{timeAgo(p.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
