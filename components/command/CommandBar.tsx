"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { EXPORT_MODES } from "@/lib/export/schema";

const CHIPS = [
  "Jarvis-style recommendation engine",
  "Real estate deal analyzer",
  "Content repurposer",
  "Inbox triage assistant",
  "Sales lead qualifier",
];

/** Maps a natural-language command to a remix action id (deterministic foundation). */
const REMIX_INTENTS: [RegExp, string][] = [
  [/premium|fire|luxur/, "make_premium"],
  [/cheaper|cheap|budget|cheaper models/, "make_cheaper"],
  [/smarter|stronger|more accurate|accurate/, "make_smarter"],
  [/faster|speed/, "make_faster"],
  [/eval|judge|score the output/, "add_evaluator"],
  [/approval|human.*(gate|review|approve)/, "add_approval"],
  [/input studio|stronger inputs|add.*dataset|reusable data/, "add_input_studio"],
  [/client.?ready|client/, "make_client_ready"],
  [/saas|subscription|productize/, "turn_into_saas"],
  [/add.*ui|ui preview|add a ui/, "add_ui"],
];

export function CommandBar() {
  const generate = usePipelineStore((s) => s.generate);
  const generating = usePipelineStore((s) => s.generating);
  const notice = usePipelineStore((s) => s.notice);
  const setNotice = usePipelineStore((s) => s.setNotice);
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const openInputStudio = usePipelineStore((s) => s.openInputStudio);
  const setPanelTab = usePipelineStore((s) => s.setPanelTab);
  const setSourceMode = usePipelineStore((s) => s.setSourceMode);
  const startRemix = usePipelineStore((s) => s.startRemix);
  const explain = usePipelineStore((s) => s.explain);
  const openExport = usePipelineStore((s) => s.openExport);
  const runExport = usePipelineStore((s) => s.runExport);
  const rerunTeam = usePipelineStore((s) => s.rerunTeam);
  const [text, setText] = useState("");

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
        { label: "Compare Takes", run: () => setPanelTab("takes") },
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
  const contextChips = isTeam ? teamChips : isSource ? sourceChips : null;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  const submit = (value?: string) => {
    const v = (value ?? text).trim();
    if (!v || generating) return;

    // Deterministic intent routing: remix / product commands act on the current
    // pipeline; everything else generates a new one.
    const lower = v.toLowerCase();

    // Export intents (independent of the imperative-verb gate below).
    if (pipeline && /\bexport\b|bounce everything|client blueprint|founder brief|implementation plan|developer package/.test(lower)) {
      setText("");
      if (/bounce everything|export all|everything/.test(lower)) void runExport([...EXPORT_MODES]);
      else openExport();
      return;
    }

    const isCommand = /^(make|add|turn|use|reduce|compress|split|show|explain|compare)\b/.test(lower) || /\bthis\b/.test(lower);
    if (pipeline && isCommand) {
      if (/explain/.test(lower)) {
        setText("");
        setPanelTab("product");
        explain("founder");
        return;
      }
      if (/missing|reality|how buildable/.test(lower)) {
        setText("");
        setPanelTab("product");
        setNotice("Reality Meter is in the Product tab.");
        return;
      }
      if (/compare.*take|compare the last/.test(lower)) {
        setText("");
        setPanelTab("takes");
        return;
      }
      const remix = REMIX_INTENTS.find(([re]) => re.test(lower));
      if (remix) {
        setText("");
        startRemix(remix[1]);
        return;
      }
    }

    setText("");
    void generate(v);
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
      ) : null}

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
            placeholder="Describe the AI system you want to build…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={generating || !text.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet text-white transition hover:bg-violet/90 disabled:opacity-40"
            aria-label="Generate pipeline"
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </form>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {contextChips
            ? contextChips.map((c) => (
                <button
                  key={c.label}
                  onClick={c.run}
                  className="flex items-center gap-1 rounded-full border border-violet/30 bg-violet/[0.06] px-3 py-1 text-xs text-violet transition hover:bg-violet/[0.12]"
                >
                  <Sparkles size={11} /> {c.label}
                </button>
              ))
            : CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => submit(c)}
                  disabled={generating}
                  className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-ink-dim transition hover:bg-white/[0.08] hover:text-ink disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}
