"use client";

import { useState } from "react";
import { Braces, Download, Loader2, Play, Plus, Type } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { exportPipeline } from "@/lib/pipeline/exporter";
import { ACCENT_HEX, isAccent } from "@/lib/ui/colors";
import { cn } from "@/lib/ui/cn";
import { TableList } from "./TableList";
import { UIPreview } from "./UIPreview";

const TABS = [
  { id: "preview", label: "Preview" },
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
] as const;

export function OutputPanel() {
  const panelOpen = usePipelineStore((s) => s.panelOpen);
  const panelTab = usePipelineStore((s) => s.panelTab);
  const setPanelTab = usePipelineStore((s) => s.setPanelTab);
  const connectToUI = usePipelineStore((s) => s.connectToUI);
  const tables = usePipelineStore((s) => s.tables);
  const pipeline = usePipelineStore((s) => s.pipeline);

  if (!panelOpen) return null;
  const bindings = pipeline?.uiBindings ?? [];

  return (
    <aside className="z-20 flex h-full w-[372px] shrink-0 flex-col border-l border-line bg-[#09090f]/80 backdrop-blur-xl">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setPanelTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] transition",
              panelTab === t.id ? "bg-white/[0.08] text-ink" : "text-ink-dim hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {panelTab === "output" && <OutputTab />}
        {panelTab === "input" && <InputTab />}
        {panelTab === "preview" && <UIPreview tables={connectToUI ? tables : []} bindings={bindings} />}
      </div>
    </aside>
  );
}

function OutputTab() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const tables = usePipelineStore((s) => s.tables);
  const finalOutput = usePipelineStore((s) => s.finalOutput);
  const connectToUI = usePipelineStore((s) => s.connectToUI);
  const setConnectToUI = usePipelineStore((s) => s.setConnectToUI);
  const setNotice = usePipelineStore((s) => s.setNotice);
  const [jsonMode, setJsonMode] = useState(false);

  const onExport = async () => {
    if (!pipeline) return;
    await exportPipeline(pipeline, { tables, finalOutput });
    setNotice("Exported pipeline files (.zip)");
  };

  return (
    <div className="space-y-5">
      <section>
        <SectionHeader title="Final Output">
          <button
            onClick={() => setJsonMode((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 py-1 text-[11px] text-ink-dim transition hover:text-ink"
          >
            {jsonMode ? <Braces size={12} /> : <Type size={12} />}
            {jsonMode ? "JSON" : "Text"}
          </button>
        </SectionHeader>

        {finalOutput ? (
          jsonMode ? (
            <pre className="max-h-64 overflow-auto rounded-xl border border-line bg-black/40 p-3 font-mono text-[10.5px] text-ink-dim">
              {JSON.stringify(finalOutput, null, 2)}
            </pre>
          ) : (
            <div className="rounded-xl border border-line bg-white/[0.03] p-3.5">
              <div className="text-[13px] font-semibold text-ink">{finalOutput.title}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{finalOutput.summary}</p>
            </div>
          )
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
            Run the pipeline to generate the final output.
          </p>
        )}
      </section>

      {finalOutput?.highlights?.length ? (
        <section>
          <SectionHeader title="Key Highlights" />
          <div className="space-y-0.5">
            {finalOutput.highlights.map((h, i) => {
              const color = h.accent && isAccent(h.accent) ? ACCENT_HEX[h.accent] : "#8b8b9e";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-line/50 py-2 last:border-0"
                >
                  <span className="flex items-center gap-2 text-[12.5px] text-ink-dim">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    {h.label}
                  </span>
                  <span className="text-[12.5px] font-medium text-ink">{h.value}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Output Tables">
          <button
            onClick={() => setNotice("Tables are produced by your pipeline nodes — add a node to emit a new one.")}
            className="flex items-center gap-1 text-[11px] text-violet transition hover:text-violet/80"
          >
            <Plus size={12} /> Add Table
          </button>
        </SectionHeader>
        <TableList tables={tables} bindings={pipeline?.uiBindings ?? []} />
      </section>

      <section className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5">
        <div>
          <div className="text-[13px] font-medium text-ink">Connect to UI</div>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-faint">
            This output is connected to your side-panel UI preview.
          </p>
        </div>
        <Switch checked={connectToUI} onChange={setConnectToUI} />
      </section>

      <button
        onClick={() => void onExport()}
        disabled={!pipeline}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.04] py-2.5 text-[13px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
      >
        <Download size={15} /> Export pipeline (.zip)
      </button>
    </div>
  );
}

function InputTab() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const setMockInput = usePipelineStore((s) => s.setMockInput);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const runStatus = usePipelineStore((s) => s.runStatus);

  if (!pipeline || pipeline.mockInputs.length === 0) {
    return <p className="text-xs text-ink-faint">This pipeline has no configurable inputs.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-ink-faint">These inputs feed the pipeline when you run it.</p>
      <div className="space-y-3">
        {pipeline.mockInputs.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[11px] text-ink-dim">{f.label}</span>
            <input
              value={f.value}
              placeholder={f.placeholder}
              onChange={(e) => setMockInput(f.key, e.target.value)}
              className="w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
            />
          </label>
        ))}
      </div>
      <button
        onClick={() => void runPipeline()}
        disabled={runStatus === "running"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
      >
        {runStatus === "running" ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} className="fill-current" />}
        Run pipeline
      </button>
    </div>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[12px] font-medium text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-violet" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
