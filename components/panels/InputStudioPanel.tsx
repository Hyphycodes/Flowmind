"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Sparkles, TriangleAlert, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { GENERATION_STYLES, QUALITY_TARGETS } from "@/lib/pipeline/schema";
import { SCENARIO_PRESETS } from "@/lib/datasets/scenarios";
import { cn } from "@/lib/ui/cn";

const QUALITY_LABEL: Record<string, string> = {
  realistic: "Realistic",
  high_quality: "High quality",
  edge_cases: "Edge cases",
  production_like: "Production-like",
};
const STYLE_LABEL: Record<string, string> = {
  api_like: "API-like",
  user_like: "User-like",
  business_like: "Business-like",
  edge_case_pack: "Edge-case pack",
};

export function InputStudioPanel() {
  const inputStudio = usePipelineStore((s) => s.inputStudio);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const datasets = usePipelineStore((s) => s.datasets);
  const generating = usePipelineStore((s) => s.datasetGenerating);
  const modelAvailable = usePipelineStore((s) => s.modelAvailable);
  const generateDataset = usePipelineStore((s) => s.generateDataset);
  const applyDatasetToNode = usePipelineStore((s) => s.applyDatasetToNode);
  const upsertDataset = usePipelineStore((s) => s.upsertDataset);
  const setActiveDataset = usePipelineStore((s) => s.setActiveDataset);
  const closeInputStudio = usePipelineStore((s) => s.closeInputStudio);

  const node = inputStudio.nodeId ? pipeline?.nodes.find((n) => n.id === inputStudio.nodeId) : undefined;

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [rowCount, setRowCount] = useState(20);
  const [quality, setQuality] = useState<(typeof QUALITY_TARGETS)[number]>("high_quality");
  const [style, setStyle] = useState<(typeof GENERATION_STYLES)[number]>("api_like");
  const [scenarioTags, setScenarioTags] = useState<string[]>([]);
  const [required, setRequired] = useState("");
  const [resultId, setResultId] = useState<string | null>(null);

  const result = useMemo(
    () => (resultId ? datasets.find((d) => d.id === resultId) : undefined),
    [resultId, datasets],
  );

  // Prefill from the source node each time the studio opens.
  useEffect(() => {
    if (!inputStudio.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally reset the form fields when the studio opens for a node
    setResultId(null);
    setName(node?.source?.datasetName ?? (node ? `${node.title} dataset` : "New dataset"));
    setPrompt(node?.source?.prompt ?? node?.description ?? "");
    setRowCount(node?.source?.rowCount ?? 20);
    setScenarioTags(node?.source?.scenario ? [node.source.scenario] : []);
    setRequired("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputStudio.open, inputStudio.nodeId]);

  if (!inputStudio.open) return null;

  const requiredFields = required
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const buildInput = (extra?: { existingRows?: Record<string, unknown>[]; datasetId?: string }) => ({
    name,
    prompt,
    rowCount,
    qualityTarget: quality,
    generationStyle: style,
    scenarioTags,
    requiredFields,
    columns: result?.schema?.length ? result.schema.map((c) => ({ key: c.key, label: c.label, type: c.type })) : undefined,
    ...extra,
  });

  const run = async (extra?: { existingRows?: Record<string, unknown>[]; datasetId?: string }) => {
    const ds = await generateDataset(buildInput(extra));
    if (ds) setResultId(ds.id);
  };

  const toggleScenario = (tag: string) =>
    setScenarioTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      onClick={closeInputStudio}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fade-up flex max-h-full w-[460px] flex-col overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/15 text-violet">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-ink">Input Studio</div>
              <div className="text-[10.5px] text-ink-faint">
                {node ? `Strong inputs for ${node.title}` : "Design reusable strong inputs"}
              </div>
            </div>
          </div>
          <button onClick={closeInputStudio} className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
          {modelAvailable === false && (
            <div className="flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] p-2.5 text-[11px] leading-relaxed text-ink-dim">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-gold" />
              No model key set — Input Studio will produce a deterministic demo dataset. Add
              <code className="mx-1 font-mono text-ink">ANTHROPIC_API_KEY</code> for strong generation.
            </div>
          )}

          <Field label="Dataset name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-line-strong"
            />
          </Field>

          <Field label="Source prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Describe the strong inputs to generate…"
              className="w-full resize-none rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink outline-none focus:border-line-strong"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Row count">
              <input
                type="number"
                min={1}
                max={60}
                value={rowCount}
                onChange={(e) => setRowCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-line-strong"
              />
            </Field>
            <Field label="Quality target">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                className="w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-line-strong"
              >
                {QUALITY_TARGETS.map((q) => (
                  <option key={q} value={q}>
                    {QUALITY_LABEL[q]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Generation style">
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as typeof style)}
              className="w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 text-[12.5px] text-ink outline-none focus:border-line-strong"
            >
              {GENERATION_STYLES.map((s) => (
                <option key={s} value={s}>
                  {STYLE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Scenario tags">
            <div className="flex flex-wrap gap-1">
              {SCENARIO_PRESETS.map((sc) => {
                const active = scenarioTags.includes(sc.tag);
                return (
                  <button
                    key={sc.id}
                    onClick={() => toggleScenario(sc.tag)}
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
          </Field>

          <Field label="Required fields (comma-separated)">
            <input
              value={required}
              onChange={(e) => setRequired(e.target.value)}
              placeholder="name, rating, price_level"
              className="w-full rounded-lg border border-line bg-black/30 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-line-strong"
            />
          </Field>

          {result && (
            <div className="rounded-lg border border-violet/30 bg-violet/[0.05] p-2.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-medium text-ink">{result.name}</span>
                <span className="text-ink-faint">
                  {result.rows.length} rows · {result.qualityScore ?? 0}%
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.schema.slice(0, 8).map((c) => (
                  <span key={c.key} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] text-ink-dim">
                    {c.key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3">
          <button
            onClick={() => void run()}
            disabled={generating || !prompt.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {result ? "Regenerate" : "Generate Dataset"}
          </button>
          {result && (
            <button
              onClick={() => void run({ existingRows: result.rows, datasetId: result.id })}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
            >
              <Plus size={13} /> Extend
            </button>
          )}
          {result && (
            <button
              onClick={() => {
                upsertDataset(result);
                setActiveDataset(result.id);
              }}
              className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-ink-dim transition hover:text-ink"
            >
              View
            </button>
          )}
          <div className="flex-1" />
          {result && node && (
            <button
              onClick={() => {
                applyDatasetToNode(node.id, result.id);
                closeInputStudio();
              }}
              className="rounded-lg border border-violet/40 bg-violet/[0.1] px-2.5 py-1.5 text-[12.5px] font-medium text-violet transition hover:bg-violet/[0.18]"
            >
              Use in this Source Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
