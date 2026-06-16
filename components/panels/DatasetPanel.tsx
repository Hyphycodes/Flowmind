"use client";

import { useState } from "react";
import { saveAs } from "file-saver";
import {
  ArrowLeft,
  Check,
  Copy,
  Database,
  Download,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import type { Dataset } from "@/lib/datasets/schema";
import { usePipelineStore } from "@/store/pipelineStore";
import { detectMissingValues } from "@/lib/datasets/quality";
import { REPAIR_ACTIONS } from "@/lib/datasets/repair";
import { SOURCE_MODE_LABEL } from "@/lib/datasets/sourceModes";
import { newId } from "@/lib/pipeline/validate";
import { formatCell, timeAgo } from "@/lib/ui/format";
import { cn } from "@/lib/ui/cn";

function qualityColor(q?: number): string {
  if (q == null) return "#6f7088";
  if (q >= 85) return "#34d399";
  if (q >= 65) return "#f5c451";
  return "#fb923c";
}

export function DatasetPanel() {
  const datasets = usePipelineStore((s) => s.datasets);
  const activeDatasetId = usePipelineStore((s) => s.activeDatasetId);
  const setActiveDataset = usePipelineStore((s) => s.setActiveDataset);
  const openInputStudio = usePipelineStore((s) => s.openInputStudio);

  const active = activeDatasetId ? datasets.find((d) => d.id === activeDatasetId) : undefined;

  if (active) return <DatasetViewer dataset={active} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
          <Database size={13} className="text-violet" /> Dataset Library
        </h3>
        <button
          onClick={() => openInputStudio(null)}
          className="flex items-center gap-1 rounded-md border border-line bg-white/[0.03] px-2 py-1 text-[11px] text-violet transition hover:text-violet/80"
        >
          <Sparkles size={11} /> New dataset
        </button>
      </div>

      {datasets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-ink-faint">
          No datasets yet. Generate strong inputs with Input Studio.
        </p>
      ) : (
        <div className="space-y-1.5">
          {datasets.map((d) => (
            <DatasetCard key={d.id} dataset={d} onOpen={() => setActiveDataset(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DatasetCard({ dataset: d, onOpen }: { dataset: Dataset; onOpen: () => void }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const applyDatasetToNode = usePipelineStore((s) => s.applyDatasetToNode);
  const connectedNode = d.connectedNodeId
    ? pipeline?.nodes.find((n) => n.id === d.connectedNodeId)
    : undefined;
  const selectedNode = selectedNodeId ? pipeline?.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const canBind = Boolean(
    selectedNode &&
      (selectedNode.source ||
        selectedNode.layer === "source" ||
        selectedNode.type === "input" ||
        selectedNode.type === "tool"),
  );

  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-2.5">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] font-medium text-ink">{d.name}</span>
          <span className="ml-auto shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-ink-dim">
            {SOURCE_MODE_LABEL[d.mode]}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-ink-faint">
          <span>{d.rows.length} rows</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: qualityColor(d.qualityScore) }} />
            {d.qualityScore ?? 0}%
          </span>
          {connectedNode && <span>· {connectedNode.title}</span>}
          {d.updatedAt && <span>· {timeAgo(d.updatedAt)}</span>}
        </div>
        {d.scenarioTags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {d.scenarioTags.map((t) => (
              <span key={t} className="rounded bg-violet/10 px-1.5 py-0.5 text-[9px] text-violet">
                {t}
              </span>
            ))}
          </div>
        )}
      </button>
      {canBind && (
        <button
          onClick={() => applyDatasetToNode(selectedNodeId!, d.id)}
          className="mt-2 w-full rounded-md border border-violet/40 bg-violet/[0.08] py-1 text-[11px] font-medium text-violet transition hover:bg-violet/[0.16]"
        >
          Use in {selectedNode?.title}
        </button>
      )}
    </div>
  );
}

function DatasetViewer({ dataset: d }: { dataset: Dataset }) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const setActiveDataset = usePipelineStore((s) => s.setActiveDataset);
  const applyDatasetToNode = usePipelineStore((s) => s.applyDatasetToNode);
  const upsertDataset = usePipelineStore((s) => s.upsertDataset);
  const removeDataset = usePipelineStore((s) => s.removeDataset);
  const repairDataset = usePipelineStore((s) => s.repairDataset);
  const setNotice = usePipelineStore((s) => s.setNotice);
  const [copied, setCopied] = useState(false);

  const missing = detectMissingValues(d.schema, d.rows).filter((m) => m.emptyRate > 0);
  const selectedNode = selectedNodeId ? pipeline?.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const canBind = Boolean(
    selectedNode &&
      (selectedNode.source ||
        selectedNode.layer === "source" ||
        selectedNode.type === "input" ||
        selectedNode.type === "tool"),
  );

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(d.rows, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice("Could not copy to clipboard.");
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    saveAs(blob, `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
  };

  const duplicate = () => {
    upsertDataset({ ...d, id: newId("ds"), name: `${d.name} copy`, connectedNodeId: undefined });
    setNotice(`Duplicated "${d.name}".`);
  };

  const duplicateRow = (i: number) => {
    const rows = [...d.rows];
    rows.splice(i + 1, 0, { ...rows[i] });
    upsertDataset({ ...d, rows });
  };
  const deleteRow = (i: number) => upsertDataset({ ...d, rows: d.rows.filter((_, j) => j !== i) });

  return (
    <div className="space-y-3">
      <button
        onClick={() => setActiveDataset(null)}
        className="flex items-center gap-1.5 text-[11px] text-ink-dim transition hover:text-ink"
      >
        <ArrowLeft size={13} /> Dataset Library
      </button>

      <div>
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14px] font-medium text-ink">{d.name}</h3>
          <span className="ml-auto shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-ink-dim">
            {SOURCE_MODE_LABEL[d.mode]}
          </span>
        </div>
        {d.description && <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">{d.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-faint">
          <span>{d.rows.length} rows</span>
          <span>· {d.schema.length} fields</span>
          <span className="flex items-center gap-1">
            ·
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: qualityColor(d.qualityScore) }} />
            Quality {d.qualityScore ?? 0}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5">
        {canBind && (
          <Btn onClick={() => applyDatasetToNode(selectedNodeId!, d.id)} accent>
            Use in {selectedNode?.title}
          </Btn>
        )}
        <Btn onClick={() => void copyJson()} icon={copied ? Check : Copy}>
          {copied ? "Copied" : "Copy JSON"}
        </Btn>
        <Btn onClick={exportJson} icon={Download}>
          Export
        </Btn>
        <Btn onClick={duplicate} icon={Plus}>
          Duplicate
        </Btn>
        <Btn onClick={() => void removeDataset(d.id)} icon={Trash2} danger>
          Delete
        </Btn>
      </div>

      {/* Repair */}
      <div className="rounded-xl border border-line bg-white/[0.02] p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-faint">
          <Wrench size={11} /> Data Repair
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {REPAIR_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => repairDataset(d.id, a.id)}
              title={a.hint}
              className="rounded-md border border-line bg-white/[0.03] px-2 py-1 text-left text-[10.5px] text-ink-dim transition hover:bg-white/[0.07] hover:text-ink"
            >
              {a.label}
            </button>
          ))}
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-[10.5px] leading-relaxed text-gold">
            Missing values in {missing.map((m) => `${m.key} (${Math.round(m.emptyRate * 100)}%)`).join(", ")}.
          </p>
        )}
      </div>

      {/* Schema */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">Schema</div>
        <div className="flex flex-wrap gap-1">
          {d.schema.map((c) => (
            <span key={c.key} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] text-ink-dim">
              {c.key}
              <span className="text-ink-faint"> :{c.type}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">
          Rows ({d.rows.length})
        </div>
        <div className="max-h-[340px] overflow-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-[10.5px]">
            <thead className="sticky top-0 bg-[#10101a]">
              <tr className="border-b border-line">
                {d.schema.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-1.5 text-left font-medium text-ink-faint">
                    {c.label}
                  </th>
                ))}
                <th className="px-1" />
              </tr>
            </thead>
            <tbody>
              {d.rows.slice(0, 60).map((row, i) => (
                <tr key={i} className="group border-b border-line/60 last:border-0">
                  {d.schema.map((c) => (
                    <td key={c.key} className="max-w-[180px] truncate whitespace-nowrap px-2 py-1.5 text-ink-dim">
                      {formatCell(row[c.key], c.type)}
                    </td>
                  ))}
                  <td className="px-1">
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => duplicateRow(i)}
                        title="Duplicate row"
                        className="text-ink-faint transition hover:text-ink"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => deleteRow(i)}
                        title="Delete row"
                        className="text-ink-faint transition hover:text-red"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.rows.length > 60 && (
          <p className="mt-1 text-[10px] text-ink-faint">Showing first 60 of {d.rows.length} rows.</p>
        )}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  icon: Icon,
  accent,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition",
        accent
          ? "border-violet/40 bg-violet/[0.1] font-medium text-violet hover:bg-violet/[0.18]"
          : danger
            ? "border-line bg-white/[0.03] text-ink-dim hover:text-red"
            : "border-line bg-white/[0.03] text-ink-dim hover:text-ink",
      )}
    >
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}
