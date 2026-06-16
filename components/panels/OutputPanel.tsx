"use client";

import { useState } from "react";
import { AlertTriangle, Braces, Loader2, Play, Route } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { packetTimeline } from "@/lib/packets/packetUtils";
import { ACCENT_HEX, isAccent } from "@/lib/ui/colors";
import { cn } from "@/lib/ui/cn";
import { TableList } from "./TableList";
import { UIPreview } from "./UIPreview";
import { DatasetPanel } from "./DatasetPanel";
import { TakesPanel } from "./TakesPanel";
import { RunTimeline } from "./RunTimeline";
import { ProductPanel } from "./ProductPanel";

const TABS = [
  { id: "build", label: "Build" },
  { id: "run", label: "Run" },
  { id: "data", label: "Data" },
] as const;

export function OutputPanel() {
  const panelOpen = usePipelineStore((s) => s.panelOpen);
  const panelTab = usePipelineStore((s) => s.panelTab);
  const setPanelTab = usePipelineStore((s) => s.setPanelTab);

  if (!panelOpen) return null;

  return (
    <aside className="z-20 flex h-full w-[372px] shrink-0 flex-col border-l border-line bg-[#09090f]/80 backdrop-blur-xl">
      <div className="flex items-center gap-1 border-b border-line px-2 py-2.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setPanelTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition",
              panelTab === t.id ? "bg-white/[0.08] text-ink" : "text-ink-dim hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {panelTab === "build" && <ProductPanel />}
        {panelTab === "run" && <RunTab />}
        {panelTab === "data" && <DatasetPanel />}
      </div>
    </aside>
  );
}

/* ── Run — the hero tab: inputs → results → trace ─────────────────────────── */

function RunTab() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const tables = usePipelineStore((s) => s.tables);
  const finalOutput = usePipelineStore((s) => s.finalOutput);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const setMockInput = usePipelineStore((s) => s.setMockInput);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const connectToUI = usePipelineStore((s) => s.connectToUI);

  const fields = pipeline?.mockInputs ?? [];
  const bindings = pipeline?.uiBindings ?? [];
  const running = runStatus === "running";
  const ran = Boolean(finalOutput) || tables.some((t) => t.rows.length > 0);

  const inputForm = (
    <div className="space-y-3">
      {fields.length > 0 ? (
        fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-[11px] text-ink-dim">{f.label}</span>
            <input
              value={f.value}
              placeholder={f.placeholder}
              onChange={(e) => setMockInput(f.key, e.target.value)}
              className="w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
            />
          </label>
        ))
      ) : (
        <p className="text-[11px] text-ink-faint">This pipeline has no configurable inputs.</p>
      )}
      <button
        onClick={() => void runPipeline()}
        disabled={running || !pipeline}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
      >
        {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} className="fill-current" />}
        Run pipeline
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Inputs — compact; collapsed under a disclosure once a run has results */}
      {ran ? (
        <details className="rounded-xl border border-line bg-white/[0.02]">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] font-medium text-ink-dim transition hover:text-ink">
            Change inputs ↓
          </summary>
          <div className="px-3 pb-3">{inputForm}</div>
        </details>
      ) : (
        inputForm
      )}

      {/* Results — the hero */}
      {ran || running ? (
        <div className="space-y-4">
          {finalOutput && (
            <section className="rounded-2xl border border-line bg-gradient-to-b from-white/[0.05] to-transparent p-4">
              <h2 className="text-[17px] font-semibold leading-tight text-ink">{finalOutput.title}</h2>
              {finalOutput.summary && (
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{finalOutput.summary}</p>
              )}
              {finalOutput.highlights?.length ? (
                <div className="mt-3 space-y-0.5">
                  {finalOutput.highlights.map((h, i) => {
                    const color = h.accent && isAccent(h.accent) ? ACCENT_HEX[h.accent] : "#8b8b9e";
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 border-b border-line/40 py-1.5 last:border-0">
                        <span className="flex items-center gap-2 text-[12.5px] text-ink-dim">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                          {h.label}
                        </span>
                        <span className="text-right text-[12.5px] font-medium text-ink">{h.value}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          )}

          <TableList tables={tables} bindings={bindings} />

          {connectToUI && bindings.length > 0 && tables.some((t) => t.rows.length > 0) && (
            <UIPreview tables={tables} bindings={bindings} />
          )}

          {/* Trace — look-deeper tools, closed by default */}
          <details className="rounded-xl border border-line bg-white/[0.02]">
            <summary className="cursor-pointer list-none px-3 py-2 text-[11.5px] font-medium text-ink-dim transition hover:text-ink">
              Run trace
            </summary>
            <div className="space-y-6 border-t border-line px-3 pb-3 pt-3">
              <section>
                <h3 className="mb-2 text-[12px] font-medium text-ink">Timeline</h3>
                <RunTimeline />
              </section>
              <PacketTab />
              <TakesPanel />
            </div>
          </details>
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 text-center">
          <p className="text-[13px] text-ink">Run the pipeline to see results here.</p>
        </div>
      )}
    </div>
  );
}

/* ── Packet timeline (rendered inside the Run-trace disclosure) ────────────── */

function PacketTab() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const packets = usePipelineStore((s) => s.handoffPackets);
  const packetWarnings = usePipelineStore((s) => s.packetWarnings);
  const selectedPacketId = usePipelineStore((s) => s.selectedPacketId);
  const selectPacket = usePipelineStore((s) => s.selectPacket);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const [rawOpen, setRawOpen] = useState(false);

  if (!pipeline) return null;
  const timeline = packetTimeline(pipeline, packets);
  const selected = timeline.find((entry) => entry.packet.packetId === selectedPacketId) ?? timeline[0];
  const selectedWarnings = selected
    ? packetWarnings.filter((warning) => warning.packetId === selected.packet.packetId)
    : [];

  if (timeline.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-line px-5 text-center">
        <Route className="mb-3 text-ink-faint" size={20} />
        <p className="text-[13px] text-ink">No handoff packets yet.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
          Run a pipeline with Team Nodes to see what each team hands off.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <SectionHeader title="Packet timeline" />
        <div className="space-y-2">
          {timeline.map((entry, index) => {
            const active = entry.packet.packetId === selected?.packet.packetId;
            return (
              <button
                key={entry.packet.packetId}
                type="button"
                onClick={() => {
                  selectPacket(entry.packet.packetId);
                  selectNode(entry.packet.fromNodeId);
                }}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition",
                  active ? "border-violet/60 bg-violet/[0.08]" : "border-line bg-white/[0.025] hover:border-line-strong",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Packet {index + 1}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{Math.round(entry.packet.confidence * 100)}%</span>
                </div>
                <div className="mt-1 text-[12.5px] font-medium text-ink">
                  {entry.fromTitle} {"->"} {entry.toTitle}
                </div>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-ink-dim">{entry.packet.summary}</p>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="space-y-3">
          <SectionHeader title="Selected packet">
            <button
              type="button"
              onClick={() => setRawOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 py-1 text-[11px] text-ink-dim transition hover:text-ink"
            >
              <Braces size={12} />
              {rawOpen ? "Hide JSON" : "Raw JSON"}
            </button>
          </SectionHeader>

          <div className="rounded-xl border border-line bg-white/[0.03] p-3.5">
            <div className="text-[13px] font-semibold text-ink">
              {selected.fromTitle} {"->"} {selected.toTitle}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{selected.packet.summary}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <PacketFields label="Added" fields={selected.packet.fieldChanges.added} />
              <PacketFields label="Compressed" fields={selected.packet.fieldChanges.compressed} />
              <PacketFields label="Dropped" fields={selected.packet.fieldChanges.dropped} />
              <PacketFields label="Missing" fields={selected.packet.missingData} />
            </div>
          </div>

          {(selected.packet.warnings.length > 0 || selectedWarnings.length > 0) && (
            <div className="space-y-1.5">
              {[...selected.packet.warnings.map((message) => ({ message, severity: "warning" as const })), ...selectedWarnings].map(
                (warning, index) => (
                  <div
                    key={`${warning.message}-${index}`}
                    className="flex gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] p-2.5 text-[11.5px] leading-relaxed text-ink-dim"
                  >
                    <AlertTriangle className="mt-0.5 shrink-0 text-gold" size={13} />
                    <span>{warning.message}</span>
                  </div>
                ),
              )}
            </div>
          )}

          {rawOpen && (
            <pre className="max-h-80 overflow-auto rounded-xl border border-line bg-black/40 p-3 font-mono text-[10.5px] text-ink-dim">
              {JSON.stringify(selected.packet, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}

function PacketFields({ label, fields }: { label: string; fields: string[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-black/20 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="truncate text-[11.5px] text-ink-dim">{fields.length ? fields.join(", ") : "None"}</div>
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
