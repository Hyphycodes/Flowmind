"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { pipelineSchema } from "@/lib/pipeline/schema";
import { FIXTURE_DATASETS, getTemplate, instantiatePipeline } from "@/lib/pipeline/fixtures";
import { newId } from "@/lib/pipeline/validate";
import { hasSupabase } from "@/lib/supabase/client";
import {
  getLatestRun,
  getPipeline,
  listPipelines,
  saveRun,
  upsertPipeline,
} from "@/lib/supabase/queries";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { PipelineCanvas } from "@/components/canvas/PipelineCanvas";
import { CommandBar } from "@/components/command/CommandBar";
import { NodeInspector } from "@/components/panels/NodeInspector";
import { OutputPanel } from "@/components/panels/OutputPanel";
import { InputStudioPanel } from "@/components/panels/InputStudioPanel";
import { RemixProposalModal } from "@/components/product/RemixProposalModal";
import { ExportDialog } from "@/components/export/ExportDialog";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

export function Builder() {
  const setActivePipeline = usePipelineStore((s) => s.setActivePipeline);
  const hydrateDatasets = usePipelineStore((s) => s.hydrateDatasets);
  const hydrateTakes = usePipelineStore((s) => s.hydrateTakes);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const [loading, setLoading] = useState(true);
  const booted = useRef(false);

  const startNew = () => {
    const blank = pipelineSchema.parse({
      id: newId(),
      name: "Untitled Pipeline",
      nodes: [],
      edges: [],
      mockInputs: [],
      outputTables: [],
      uiBindings: [],
    });
    setActivePipeline(blank, null);
    if (hasSupabase()) void upsertPipeline(blank);
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    void hydrateDatasets(FIXTURE_DATASETS);

    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new")) {
        startNew();
        window.history.replaceState({}, "", "/");
        setLoading(false);
        return;
      }

      const templateId = params.get("template");
      if (templateId) {
        const t = getTemplate(templateId);
        if (t) {
          const p = instantiatePipeline(t.pipeline);
          if (hasSupabase()) await upsertPipeline(p);
          setActivePipeline(p, { ...t.exampleRun, pipelineId: p.id });
          if (t.takes?.length) hydrateTakes(t.takes.map((tk) => ({ ...tk, pipelineId: p.id })));
          window.history.replaceState({}, "", "/");
          setLoading(false);
          return;
        }
      }

      const openId = params.get("open");
      if (openId && hasSupabase()) {
        const opened = await getPipeline(openId);
        if (opened) {
          const run = await getLatestRun(opened.id);
          setActivePipeline(opened, run);
          window.history.replaceState({}, "", "/");
          setLoading(false);
          return;
        }
      }

      const realEstate = getTemplate("tpl-real-estate")!;

      if (!hasSupabase()) {
        setActivePipeline(instantiatePipeline(realEstate.pipeline), realEstate.exampleRun);
        setLoading(false);
        return;
      }

      try {
        const list = await listPipelines();
        if (list.length === 0) {
          const p = instantiatePipeline(realEstate.pipeline);
          await upsertPipeline(p);
          const exampleRun = { ...realEstate.exampleRun, id: newId("run"), pipelineId: p.id };
          await saveRun(exampleRun);
          setActivePipeline(p, exampleRun);
        } else {
          const p = await getPipeline(list[0].id);
          if (p) {
            const run = await getLatestRun(p.id);
            setActivePipeline(p, run);
          } else {
            setActivePipeline(instantiatePipeline(realEstate.pipeline), realEstate.exampleRun);
          }
        }
      } catch {
        setActivePipeline(instantiatePipeline(realEstate.pipeline), realEstate.exampleRun);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = !loading && (!pipeline || pipeline.nodes.length === 0);

  return (
    <div className="flex h-full">
      <Sidebar onNewPipeline={startNew} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="relative flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {loading ? <CanvasLoading /> : empty ? <EmptyCanvas /> : <PipelineCanvas />}
            <NodeInspector />
            <CommandBar />
            <InputStudioPanel />
            <RemixProposalModal />
            <ExportDialog />
            <UpgradeModal />
          </div>
          <OutputPanel />
        </div>
      </div>
    </div>
  );
}

function CanvasLoading() {
  return (
    <div className="flow-canvas flex h-full w-full flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-ink-faint" size={22} />
      <span className="text-xs text-ink-faint">Loading your studio…</span>
    </div>
  );
}

const FIRST_RUN_IDEAS = [
  "Jarvis-style recommendation engine",
  "Real estate deal analyzer",
  "Content repurposing studio",
  "Inbox triage assistant",
  "Sales lead qualifier",
];

function EmptyCanvas() {
  const generate = usePipelineStore((s) => s.generate);
  const generating = usePipelineStore((s) => s.generating);

  return (
    <div className="flow-canvas flex h-full w-full items-center justify-center">
      <div className="-mt-20 w-full max-w-lg px-6 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white/[0.03]">
          <Sparkles className="text-violet" size={20} />
        </div>
        <h1 className="font-display text-[34px] italic leading-tight text-ink">What are we building?</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          Describe an AI product. Flowmind creates the teams, source data, output tables, preview,
          and a shippable blueprint.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {FIRST_RUN_IDEAS.map((idea) => (
            <button
              key={idea}
              onClick={() => void generate(idea)}
              disabled={generating}
              className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-ink-dim transition hover:border-violet/40 hover:bg-violet/[0.08] hover:text-ink disabled:opacity-50"
            >
              {idea}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-[12px]">
          <a
            href="/?template=tpl-jarvis"
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 font-medium text-white transition hover:bg-violet/90"
          >
            <Sparkles size={13} /> Open the Jarvis demo
          </a>
          <a
            href="/templates"
            className="rounded-lg border border-line-strong bg-white/[0.04] px-3 py-1.5 text-ink transition hover:bg-white/[0.1]"
          >
            Browse templates
          </a>
        </div>
        <p className="mt-4 text-[11px] text-ink-faint">…or describe your own in the command bar below.</p>
      </div>
    </div>
  );
}
