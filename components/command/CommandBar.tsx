"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { EXPORT_MODES } from "@/lib/export/schema";
import { EFFORT_LEVELS, EFFORT_HINTS, EFFORT_LABELS } from "@/lib/pipeline/effort";
import { getRemixAction } from "@/lib/product/remix";

const CHIPS = [
  "Research intelligence crew",
  "Competitive analysis engine",
  "Content repurposer",
  "Inbox triage assistant",
  "Sales lead qualifier",
];

/** The 6 structural Remix moves — they route through the same /api/edit-pipeline diff flow. */
const REMIX_MOVES: { id: string; label: string }[] = [
  { id: "add_critic", label: "Add a critic" },
  { id: "parallelize", label: "Parallelize" },
  { id: "route_models", label: "Route models" },
  { id: "add_checkpoint", label: "Add checkpoint" },
  { id: "decompose", label: "Decompose" },
  { id: "add_source", label: "Add source" },
];

export function CommandBar() {
  const generate = usePipelineStore((s) => s.generate);
  const generating = usePipelineStore((s) => s.generating);
  const proposeEdit = usePipelineStore((s) => s.proposeEdit);
  const editing = usePipelineStore((s) => s.editing);
  const editProposal = usePipelineStore((s) => s.editProposal);
  const clarify = usePipelineStore((s) => s.clarify);
  const answerClarification = usePipelineStore((s) => s.answerClarification);
  const dismissClarification = usePipelineStore((s) => s.dismissClarification);
  const effort = usePipelineStore((s) => s.effort);
  const setEffort = usePipelineStore((s) => s.setEffort);
  const notice = usePipelineStore((s) => s.notice);
  const setNotice = usePipelineStore((s) => s.setNotice);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const openInputStudio = usePipelineStore((s) => s.openInputStudio);
  const setPanelTab = usePipelineStore((s) => s.setPanelTab);
  const setSourceMode = usePipelineStore((s) => s.setSourceMode);
  const startRemix = usePipelineStore((s) => s.startRemix);
  const openExport = usePipelineStore((s) => s.openExport);
  const runExport = usePipelineStore((s) => s.runExport);
  const rerunTeam = usePipelineStore((s) => s.rerunTeam);
  const [text, setText] = useState("");

  const hasPipeline = Boolean(pipeline && pipeline.nodes.length > 0);
  const busy = generating || editing;
  const selectedNode = selectedNodeId ? pipeline?.nodes.find((n) => n.id === selectedNodeId) : undefined;
  const isTeam = Boolean(selectedNode?.team && (selectedNode.team.agents.length ?? 0) > 0);
  const isSource = Boolean(
    selectedNode &&
      !isTeam &&
      (selectedNode.source ||
        selectedNode.layer === "source" ||
        selectedNode.type === "input" ||
        selectedNode.type === "tool"),
  );

  const teamChips: { label: string; run: () => void }[] = selectedNode
    ? [
        { label: "Make this team smarter", run: () => startRemix("make_smarter") },
        { label: "Add an evaluator", run: () => startRemix("add_evaluator") },
        { label: "Re-run this team", run: () => void rerunTeam(selectedNode.id) },
        { label: "Compare Takes", run: () => setPanelTab("run") },
      ]
    : [];
  const sourceChips: { label: string; run: () => void }[] = selectedNode
    ? [
        { label: "Generate stronger inputs", run: () => openInputStudio(selectedNode.id) },
        { label: "Open Dataset Library", run: () => setPanelTab("data") },
        selectedNode.source?.mode === "live_api"
          ? { label: "Switch to Input Studio", run: () => setSourceMode(selectedNode.id, "input_studio") }
          : { label: "Switch to Live API", run: () => setSourceMode(selectedNode.id, "live_api") },
        { label: "Use a previous Take", run: () => setSourceMode(selectedNode.id, "previous_take") },
      ]
    : [];
  // On an existing pipeline (no special node), surface the structural Remix moves as edit proposals.
  const remixChips: { label: string; run: () => void }[] = hasPipeline
    ? REMIX_MOVES.map((m) => ({
        label: m.label,
        run: () => void proposeEdit(getRemixAction(m.id)?.instruction ?? m.label, { remixAction: m.id }),
      }))
    : [];
  const contextChips = isTeam ? teamChips : isSource ? sourceChips : hasPipeline ? remixChips : null;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const submit = (value?: string) => {
    const v = (value ?? text).trim();
    if (busy) return;
    // While a clarifying question is open, the input answers it (empty = "just build it").
    if (clarify) {
      setText("");
      answerClarification(v);
      return;
    }
    if (!v) return;
    const lower = v.toLowerCase();

    // Export intents act on the current pipeline (not an edit).
    if (pipeline && /\bexport\b|bounce everything|client blueprint|founder brief|implementation plan|developer package/.test(lower)) {
      setText("");
      if (/bounce everything|export all|everything/.test(lower)) void runExport([...EXPORT_MODES]);
      else openExport();
      return;
    }

    setText("");
    // Blank pipeline → generate from scratch. Existing pipeline → propose a reviewable edit diff.
    if (hasPipeline) void proposeEdit(v);
    else void generate(v);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 pb-6">
      {notice ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-ink-dim glass-strong fm-fade-up">
          <Sparkles size={12} className="text-violet" />
          {notice}
          <button onClick={() => setNotice(null)} className="text-ink-faint hover:text-ink">
            <X size={12} />
          </button>
        </div>
      ) : generating ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-ink-dim glass-strong fm-fade-up">
          <Loader2 size={12} className="animate-spin text-violet" />
          Designing teams, source data, and the product preview…
        </div>
      ) : editing ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-ink-dim glass-strong fm-fade-up">
          <Loader2 size={12} className="animate-spin text-violet" />
          Working out the change…
        </div>
      ) : null}

      {/* Ask-or-build: one inline clarifying question, with quick-picks + a "just build it" escape. */}
      {clarify && (
        <div className="pointer-events-auto w-full max-w-2xl rounded-2xl p-3.5 glass-strong fm-fade-up shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-violet" />
            <p className="text-[12.5px] leading-relaxed text-ink">{clarify.question}</p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {clarify.options.map((o) => (
              <button
                key={o}
                onClick={() => answerClarification(o)}
                className="rounded-full border border-violet/30 bg-violet/[0.06] px-3 py-1 text-xs text-violet transition hover:bg-violet/[0.12]"
              >
                {o}
              </button>
            ))}
            <button
              onClick={dismissClarification}
              className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-ink-dim transition hover:text-ink"
            >
              Just build something
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-auto w-full max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-2xl px-3 py-2 glass-strong shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        >
          <Sparkles size={17} className="ml-1 shrink-0 text-violet" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              clarify
                ? "Answer in a sentence, or press enter to just build it…"
                : hasPipeline
                  ? "Tell the copilot what to change…"
                  : "Describe the AI system you want to build…"
            }
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          {/* Effort sizes from-scratch generation only; on an existing pipeline edits ignore it. */}
          {!hasPipeline && (
            <select
              value={effort}
              onChange={(e) => setEffort(e.target.value as typeof effort)}
              disabled={busy}
              title={`Effort · ${EFFORT_HINTS[effort]}`}
              aria-label="Generation effort"
              className="h-8 shrink-0 cursor-pointer rounded-lg border border-line bg-white/[0.03] px-2 text-[11px] font-medium text-ink-dim outline-none transition hover:text-ink disabled:opacity-50"
            >
              {EFFORT_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl} className="bg-[#14141c] text-ink">
                  {EFFORT_LABELS[lvl]}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet text-white transition hover:bg-violet/90 disabled:opacity-40"
            aria-label={hasPipeline ? "Propose change" : "Generate pipeline"}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </form>
        {/* Hide the chips while a proposal or a clarifying question is open. */}
        {!editProposal && !clarify && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {contextChips
              ? contextChips.map((c) => (
                  <button
                    key={c.label}
                    onClick={c.run}
                    disabled={busy}
                    className="flex items-center gap-1 rounded-full border border-violet/30 bg-violet/[0.06] px-3 py-1 text-xs text-violet transition hover:bg-violet/[0.12] disabled:opacity-50"
                  >
                    <Sparkles size={11} /> {c.label}
                  </button>
                ))
              : CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => submit(c)}
                    disabled={busy}
                    className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-ink-dim transition hover:bg-white/[0.08] hover:text-ink disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
