"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Plus } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PipelineCard } from "@/components/pipelines/PipelineCard";
import { hasSupabase } from "@/lib/supabase/client";
import { deletePipeline, listPipelines, type PipelineSummary } from "@/lib/supabase/queries";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { transferPipeline } from "@/lib/workspace/queries";

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

  const open = (id: string) => router.push(`/editor?open=${id}`);

  // Agency → client handoff: move a pipeline to another workspace (must be editor in both, per RLS).
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const move = async (id: string, name: string) => {
    const others = workspaces.filter((w) => w.id !== activeId);
    if (others.length === 0) return;
    const pick = window.prompt(`Move "${name}" to a workspace:\n${others.map((w, i) => `${i + 1}. ${w.name}`).join("\n")}\n\nEnter a number:`);
    const idx = Number(pick) - 1;
    if (others[idx] && (await transferPipeline(id, others[idx].id))) {
      setPipelines((s) => (s ? s.filter((p) => p.id !== id) : s));
    }
  };

  return (
    <PageShell title="Pipelines" subtitle="Your pipelines">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[12.5px] text-ink-faint">
          {pipelines === null ? "" : `${pipelines.length} pipeline${pipelines.length === 1 ? "" : "s"}`}
        </p>
        <button
          onClick={() => router.push("/editor?new=1")}
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
            onClick={() => router.push("/editor?new=1")}
            className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
          >
            <Plus size={15} /> New pipeline
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pipelines.map((p) => (
            <PipelineCard key={p.id} pipeline={p} onOpen={open} onDelete={remove} onMove={workspaces.length >= 2 ? move : undefined} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
