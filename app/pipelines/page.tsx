"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Layers, Loader2, Plus, Trash2, X } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PipelineCard } from "@/components/pipelines/PipelineCard";
import { hasSupabase } from "@/lib/supabase/client";
import { deletePipeline, listPipelines, type PipelineSummary } from "@/lib/supabase/queries";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { transferPipeline } from "@/lib/workspace/queries";

export default function PipelinesPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineSummary[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.resolve(hasSupabase() ? listPipelines() : []).then(setPipelines);
  }, []);

  const remove = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const ok = await deletePipeline(id);
    if (ok) setPipelines((s) => (s ? s.filter((p) => p.id !== id) : s));
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Bulk delete — the explicit, user-run cleanup for the duplicate/junk rows. Confirms first,
  // lists the count, deletes each, then refreshes.
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} pipeline${selected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    setBusy(true);
    const ids = [...selected];
    const results = await Promise.all(ids.map((id) => deletePipeline(id)));
    const deleted = new Set(ids.filter((_, i) => results[i]));
    setPipelines((s) => (s ? s.filter((p) => !deleted.has(p.id)) : s));
    setBusy(false);
    exitSelect();
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-faint">
          {pipelines === null
            ? ""
            : selectMode
              ? `${selected.size} selected`
              : `${pipelines.length} pipeline${pipelines.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button
                onClick={() => void bulkDelete()}
                disabled={selected.size === 0 || busy}
                className="flex items-center gap-1.5 rounded-lg border border-red/40 bg-red/[0.08] px-3 py-1.5 text-[13px] font-medium text-red transition hover:bg-red/[0.14] disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete{selected.size > 0 ? ` ${selected.size}` : ""}
              </button>
              <button
                onClick={exitSelect}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[13px] text-ink-dim transition hover:text-ink"
              >
                <X size={15} /> Done
              </button>
            </>
          ) : (
            <>
              {pipelines && pipelines.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[13px] text-ink-dim transition hover:text-ink"
                >
                  <CheckSquare size={15} /> Select
                </button>
              )}
              <button
                onClick={() => router.push("/editor?new=1")}
                className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
              >
                <Plus size={15} /> New pipeline
              </button>
            </>
          )}
        </div>
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
            <PipelineCard
              key={p.id}
              pipeline={p}
              onOpen={open}
              onDelete={remove}
              onMove={workspaces.length >= 2 ? move : undefined}
              selectable={selectMode}
              selected={selected.has(p.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
