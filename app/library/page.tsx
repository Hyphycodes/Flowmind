"use client";

import { useEffect, useState } from "react";
import { Box, Database, FileText, Plus, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { usePipelineStore } from "@/store/pipelineStore";
import { hasSupabase } from "@/lib/supabase/client";
import { getPipeline, listDatasets, listPipelines } from "@/lib/supabase/queries";
import { detectReuse, type ReuseSuggestion } from "@/lib/library/reuse";
import type { LibraryKind } from "@/lib/library/schema";
import type { Dataset } from "@/lib/datasets/schema";
import type { Pipeline, PipelineNode } from "@/lib/pipeline/schema";
import { timeAgo } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

const TABS: { kind: LibraryKind; label: string; icon: typeof Box }[] = [
  { kind: "node", label: "Nodes", icon: Box },
  { kind: "prompt", label: "Prompts", icon: FileText },
  { kind: "tool", label: "Tools", icon: Wrench },
  { kind: "dataset_ref", label: "Datasets", icon: Database },
];

export default function LibraryPage() {
  const libraryAssets = usePipelineStore((s) => s.libraryAssets);
  const hydrateLibrary = usePipelineStore((s) => s.hydrateLibrary);
  const removeLibraryAsset = usePipelineStore((s) => s.removeLibraryAsset);
  const renameLibraryAsset = usePipelineStore((s) => s.renameLibraryAsset);
  const insertLibraryNode = usePipelineStore((s) => s.insertLibraryNode);
  const saveToLibrary = usePipelineStore((s) => s.saveToLibrary);
  const pipeline = usePipelineStore((s) => s.pipeline);

  const [tab, setTab] = useState<LibraryKind>("node");
  const [datasets, setDatasets] = useState<Dataset[] | null>(hasSupabase() ? null : []);
  const [suggestions, setSuggestions] = useState<ReuseSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    void hydrateLibrary();
    if (hasSupabase()) {
      void listDatasets().then(setDatasets);
      // Reuse detection — bounded scan of the user's pipelines, run once.
      void (async () => {
        const list = await listPipelines();
        const full: Pipeline[] = [];
        for (let i = 0; i < list.length; i += 6) {
          const batch = await Promise.all(list.slice(i, i + 6).map((p) => getPipeline(p.id)));
          for (const p of batch) if (p) full.push(p);
        }
        setSuggestions(detectReuse(full));
      })();
    }
  }, [hydrateLibrary]);

  const assets = libraryAssets.filter((a) => a.kind === tab);
  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.signature));

  const promote = (s: ReuseSuggestion) => {
    saveToLibrary({
      kind: "node",
      name: s.name,
      description: s.role || `Reused across ${s.count} pipelines`,
      payload: { ...s.node, status: "idle" } as PipelineNode,
      tags: ["reused"],
    });
    setDismissed((d) => new Set([...d, s.signature]));
  };

  return (
    <PageShell title="Library" subtitle="Your reusable building blocks">
      {/* Reuse suggestions */}
      {visibleSuggestions.length > 0 && (
        <div className="mb-5 space-y-2">
          {visibleSuggestions.map((s) => (
            <div key={s.signature} className="flex items-center gap-3 rounded-xl border border-violet/30 bg-violet/[0.05] px-4 py-2.5">
              <Sparkles size={15} className="shrink-0 text-violet" />
              <p className="min-w-0 flex-1 text-[12.5px] text-ink-dim">
                <span className="font-medium text-ink">“{s.name}”</span> appears in {s.count} pipelines
                {s.role ? ` — ${s.role}` : ""}. Save it to your Library?
              </p>
              <button
                onClick={() => promote(s)}
                className="shrink-0 rounded-lg bg-violet px-2.5 py-1 text-[12px] font-medium text-white transition hover:bg-violet/90"
              >
                Save
              </button>
              <button
                onClick={() => setDismissed((d) => new Set([...d, s.signature]))}
                aria-label="Dismiss"
                className="shrink-0 text-ink-faint transition hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 rounded-xl border border-line bg-white/[0.02] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = t.kind === "dataset_ref" ? datasets?.length ?? 0 : libraryAssets.filter((a) => a.kind === t.kind).length;
          return (
            <button
              key={t.kind}
              onClick={() => setTab(t.kind)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
                tab === t.kind ? "bg-white/[0.08] text-ink" : "text-ink-dim hover:text-ink",
              )}
            >
              <Icon size={13} /> {t.label}
              <span className="text-ink-faint">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "dataset_ref" ? (
        datasets === null ? (
          <Empty text="Loading datasets…" />
        ) : datasets.length === 0 ? (
          <Empty text="No datasets yet. Generate one in Input Studio from the editor." />
        ) : (
          <Grid>
            {datasets.map((d) => (
              <div key={d.id} className="flex flex-col rounded-2xl border border-line bg-white/[0.02] p-4">
                <h3 className="truncate text-[14px] font-medium text-ink">{d.name}</h3>
                <p className="mt-1 line-clamp-2 text-[12px] text-ink-dim">{d.description || "Dataset"}</p>
                <div className="mt-3 flex items-center gap-x-2 border-t border-line/60 pt-2.5 text-[11px] text-ink-faint">
                  <span>{d.rows.length} rows</span>
                  <span>·</span>
                  <span>{d.mode}</span>
                  <span>·</span>
                  <span>{timeAgo(d.updatedAt)}</span>
                </div>
              </div>
            ))}
          </Grid>
        )
      ) : assets.length === 0 ? (
        <Empty
          text={
            tab === "node"
              ? "No saved nodes yet. Open a node on the canvas and click “Save to Library”."
              : tab === "prompt"
                ? "No saved prompts yet. Save a node’s prompt from its popover."
                : "No saved tool configs yet."
          }
        />
      ) : (
        <Grid>
          {assets.map((a) => (
            <div key={a.id} className="group flex flex-col rounded-2xl border border-line bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 truncate text-[14px] font-medium text-ink">{a.name}</h3>
                <button
                  onClick={() => void removeLibraryAsset(a.id)}
                  aria-label="Delete"
                  className="shrink-0 text-ink-faint opacity-0 transition hover:text-red focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-dim">
                {a.kind === "prompt" ? String(a.payload ?? "").slice(0, 120) : a.description || "—"}
              </p>
              {a.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.tags.map((tag) => (
                    <span key={tag} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-faint">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-x-2 border-t border-line/60 pt-2.5 text-[11px] text-ink-faint">
                <span>used {a.usageCount}×</span>
                <span>·</span>
                <span>{timeAgo(a.updatedAt)}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                {a.kind === "node" && pipeline && (
                  <button
                    onClick={() => insertLibraryNode(a.id)}
                    className="flex items-center gap-1 rounded-lg border border-violet/40 bg-violet/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-violet transition hover:bg-violet/[0.16]"
                  >
                    <Plus size={12} /> Insert
                  </button>
                )}
                <button
                  onClick={() => {
                    const name = window.prompt("Rename asset", a.name);
                    if (name && name.trim()) renameLibraryAsset(a.id, { name: name.trim() });
                  }}
                  className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-ink-dim transition hover:text-ink"
                >
                  Rename
                </button>
              </div>
            </div>
          ))}
        </Grid>
      )}
    </PageShell>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-line p-8 text-center text-[13px] text-ink-dim">
      {text}
    </div>
  );
}
