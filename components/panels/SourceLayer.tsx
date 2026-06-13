"use client";

import { useState } from "react";
import {
  ChevronDown,
  Database,
  FlaskConical,
  Layers,
  Sparkles,
  Table2,
  Wand2,
} from "lucide-react";
import type { PipelineNode } from "@/lib/pipeline/schema";
import { usePipelineStore } from "@/store/pipelineStore";
import { getTool } from "@/lib/tools/registry";
import { checkDataContract, type ContractStatus } from "@/lib/contracts/check";
import { SOURCE_MODE_LABEL, SOURCE_MODE_OPTIONS } from "@/lib/datasets/sourceModes";
import { DriveSourceBlock } from "./DriveSourceBlock";
import { cn } from "@/lib/ui/cn";

const STATUS_STYLE: Record<ContractStatus, { label: string; cls: string; dot: string }> = {
  passing: { label: "Passing", cls: "text-green", dot: "#34d399" },
  warning: { label: "Warning", cls: "text-gold", dot: "#f5c451" },
  failing: { label: "Failing", cls: "text-red", dot: "#f87171" },
  unknown: { label: "Unknown", cls: "text-ink-faint", dot: "#6f7088" },
};

export function SourceLayer({ node }: { node: PipelineNode }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const datasets = usePipelineStore((s) => s.datasets);
  const tables = usePipelineStore((s) => s.tables);
  const setSourceMode = usePipelineStore((s) => s.setSourceMode);
  const openInputStudio = usePipelineStore((s) => s.openInputStudio);
  const setActiveDataset = usePipelineStore((s) => s.setActiveDataset);
  const setPanelTab = usePipelineStore((s) => s.setPanelTab);
  const setNodeScenario = usePipelineStore((s) => s.setNodeScenario);
  const applyFieldMapping = usePipelineStore((s) => s.applyFieldMapping);
  const bindTakeTableToSource = usePipelineStore((s) => s.bindTakeTableToSource);
  const [open, setOpen] = useState(true);
  const [showContract, setShowContract] = useState(false);

  const source = node.source;
  const mode = source?.mode ?? "input_studio";
  const dataset = source?.datasetId ? datasets.find((d) => d.id === source!.datasetId) : undefined;
  const tool = source?.toolId ? getTool(source.toolId) : undefined;
  const fallback = source?.fallbackDatasetId
    ? datasets.find((d) => d.id === source!.fallbackDatasetId)
    : undefined;

  // Downstream contract (first outgoing edge that declares expectations).
  const outEdge = pipeline?.edges.find(
    (e) => e.source === node.id && (e.contract?.expects?.length ?? 0) > 0,
  );
  const targetExpected = outEdge?.contract?.expects ?? [];
  const sourceSchema =
    dataset?.schema?.length
      ? dataset.schema
      : node.outputs.map((o) => ({ key: o, label: o, type: "text" as const }));
  const report = targetExpected.length
    ? checkDataContract({
        sourceSchema,
        rows: dataset?.rows ?? [],
        targetExpectedSchema: targetExpected,
        mappings: (pipeline?.fieldMappings ?? []).filter((m) => m.fromNodeId === node.id),
        fromNodeId: node.id,
        toNodeId: outEdge?.target,
      })
    : null;
  const status: ContractStatus = report?.status ?? "unknown";
  const scenarioSets = pipeline?.scenarioSets ?? [];

  return (
    <div className="mt-4 rounded-xl border border-line bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          <Layers size={12} /> Source Layer
        </span>
        <span className="flex items-center gap-2">
          <span
            className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-dim"
            title="Source Mode"
          >
            {SOURCE_MODE_LABEL[mode]}
          </span>
          <ChevronDown size={13} className={cn("text-ink-faint transition", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="space-y-2.5 px-3 pb-3">
          {/* Mode switcher */}
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">Mode</span>
            <select
              value={mode}
              onChange={(e) => setSourceMode(node.id, e.target.value as typeof mode)}
              className="w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-line-strong"
            >
              {SOURCE_MODE_OPTIONS.map((o) => (
                <option key={o.mode} value={o.mode}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {/* Mode-specific body */}
          {mode === "input_studio" && (
            <div className="space-y-2">
              {dataset ? (
                <div className="rounded-lg border border-line bg-black/20 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Database size={12} className="text-violet" />
                    <span className="truncate text-[12px] text-ink">{dataset.name}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                    <Pill>{dataset.rows.length} rows</Pill>
                    {dataset.qualityScore != null && <Pill>Quality {dataset.qualityScore}%</Pill>}
                    <Pill className={STATUS_STYLE[status].cls}>
                      <span
                        className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ background: STATUS_STYLE[status].dot }}
                      />
                      Contract {STATUS_STYLE[status].label}
                    </Pill>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-2.5 py-3 text-center text-[11px] text-ink-faint">
                  No dataset bound yet. Generate strong inputs to power this source.
                </p>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <Action icon={Sparkles} onClick={() => openInputStudio(node.id)}>
                  Generate stronger inputs
                </Action>
                <Action
                  icon={Table2}
                  disabled={!dataset}
                  onClick={() => dataset && setActiveDataset(dataset.id)}
                >
                  View dataset
                </Action>
                <Action icon={Layers} onClick={() => setPanelTab("data")}>
                  Use another dataset
                </Action>
                <Action icon={FlaskConical} onClick={() => setShowContract((v) => !v)}>
                  Check contract
                </Action>
              </div>
            </div>
          )}

          {mode === "live_api" && (
            <div className="space-y-1.5 rounded-lg border border-line bg-black/20 p-2.5 text-[11.5px]">
              <Row label="Tool" value={tool?.name ?? source?.toolId ?? "Not selected"} />
              <Row label="Status" value="Missing API key" valueCls="text-gold" />
              <Row label="Fallback" value={fallback?.name ?? dataset?.name ?? "None"} />
              <Action icon={Sparkles} onClick={() => openInputStudio(node.id)}>
                Create a fallback dataset
              </Action>
            </div>
          )}

          {mode === "previous_take" && (
            <PreviousTake node={node} tables={tables} bind={bindTakeTableToSource} />
          )}

          {mode === "google_drive" && <DriveSourceBlock node={node} />}

          {(mode === "uploaded_file" ||
            mode === "manual_table" ||
            mode === "memory" ||
            mode === "webhook" ||
            mode === "database") && (
            <div className="space-y-1.5 rounded-lg border border-line bg-black/20 p-2.5 text-[11.5px] text-ink-dim">
              <p>
                {SOURCE_MODE_LABEL[mode]} source. Bind a Generated Dataset as a stand-in while you
                wire the live connection.
              </p>
              <Action icon={Sparkles} onClick={() => openInputStudio(node.id)}>
                Generate stand-in data
              </Action>
            </div>
          )}

          {/* Scenario selector */}
          {scenarioSets.length > 0 && mode === "input_studio" && (
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">Scenario</span>
              <div className="flex flex-wrap gap-1">
                {scenarioSets.map((sc) => {
                  const active = source?.scenario === sc.tag;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setNodeScenario(node.id, active ? null : sc.tag)}
                      title={sc.description}
                      className={cn(
                        "rounded-md border px-1.5 py-[3px] text-[10px] transition",
                        active
                          ? "border-violet/60 bg-violet/[0.12] text-violet"
                          : "border-line bg-white/[0.02] text-ink-dim hover:text-ink",
                      )}
                    >
                      {sc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contract detail */}
          {(showContract || status === "warning" || status === "failing") && report && (
            <div className="space-y-1.5 rounded-lg border border-line bg-black/20 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">Data Contract</span>
                <span className={cn("text-[10px]", STATUS_STYLE[status].cls)}>{report.summary}</span>
              </div>
              {report.warnings.map((w, i) => (
                <p
                  key={i}
                  className={cn(
                    "text-[10.5px] leading-relaxed",
                    w.severity === "error" ? "text-red" : w.severity === "warning" ? "text-gold" : "text-ink-faint",
                  )}
                >
                  {w.message}
                </p>
              ))}
              {report.suggestedMappings.length > 0 && (
                <div className="space-y-1 border-t border-line/60 pt-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-ink-faint">Suggested mappings</span>
                  {report.suggestedMappings.map((m) => (
                    <button
                      key={m.id}
                      onClick={() =>
                        applyFieldMapping({ ...m, fromNodeId: node.id, toNodeId: outEdge?.target ?? "" })
                      }
                      className="flex w-full items-center gap-1.5 rounded-md border border-line bg-white/[0.03] px-2 py-1 text-left text-[10.5px] text-ink-dim transition hover:text-ink"
                    >
                      <Wand2 size={11} className="text-violet" />
                      Map <code className="font-mono text-ink">{m.sourceField}</code> →{" "}
                      <code className="font-mono text-ink">{m.targetField}</code>
                    </button>
                  ))}
                </div>
              )}
              {(pipeline?.fieldMappings ?? []).filter((m) => m.fromNodeId === node.id).length > 0 && (
                <div className="border-t border-line/60 pt-1.5 text-[10.5px] text-ink-faint">
                  Applied:{" "}
                  {(pipeline?.fieldMappings ?? [])
                    .filter((m) => m.fromNodeId === node.id)
                    .map((m) => `${m.sourceField}→${m.targetField}`)
                    .join(", ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviousTake({
  node,
  tables,
  bind,
}: {
  node: PipelineNode;
  tables: { id: string; name: string }[];
  bind: (nodeId: string, tableId: string, snapshot: boolean) => void;
}) {
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");
  const [snapshot, setSnapshot] = useState(true);
  const current = node.source?.tableName;

  return (
    <div className="space-y-2 rounded-lg border border-line bg-black/20 p-2.5 text-[11.5px]">
      {current ? <Row label="Take" value={node.source?.takeName ?? "Current pipeline"} /> : null}
      {current ? <Row label="Table" value={current} /> : null}
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">Output table</span>
        <select
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          className="w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-line-strong"
        >
          {tables.length === 0 && <option value="">Run a pipeline first…</option>}
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[11px] text-ink-dim">
        <input
          type="checkbox"
          checked={snapshot}
          onChange={(e) => setSnapshot(e.target.checked)}
          className="h-3.5 w-3.5 accent-violet"
        />
        Copy rows into a Dataset snapshot
      </label>
      <Action icon={Table2} disabled={!tableId} onClick={() => tableId && bind(node.id, tableId, snapshot)}>
        Use this table as input
      </Action>
    </div>
  );
}

function Action({
  icon: Icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2 py-1.5 text-left text-[11px] text-ink-dim transition hover:bg-white/[0.07] hover:text-ink disabled:opacity-40"
    >
      <Icon size={12} className="shrink-0 text-violet" />
      <span className="truncate">{children}</span>
    </button>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-md bg-white/[0.06] px-1.5 py-0.5 text-ink-dim", className)}>{children}</span>
  );
}

function Row({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-faint">{label}</span>
      <span className={cn("truncate text-ink", valueCls)}>{value}</span>
    </div>
  );
}
