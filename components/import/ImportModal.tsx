"use client";

import { useRef, useState } from "react";
import { FolderUp, Loader2, ShieldCheck, X, AlertTriangle, Check } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import type { ImportIR, ImportReport, ImportedAgent } from "@/lib/import/ir";
import { pipelineSchema } from "@/lib/pipeline/schema";

const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|md|txt)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|venv|\.venv|__pycache__|coverage|vendor)(\/|$)/;
const MAX_FILES = 400;

type Phase = "pick" | "reviewing";

/**
 * Import existing code → a visual pipeline (Prompt 21). Files are read in the browser and POSTed to
 * the server for STATIC analysis only — the code is never sent to an AI model (stated below). The
 * review step lets the user rename detections and exclude false positives before accepting.
 */
export function ImportModal() {
  const open = usePipelineStore((s) => s.importOpen);
  const close = usePipelineStore((s) => s.closeImport);
  const setActivePipeline = usePipelineStore((s) => s.setActivePipeline);

  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [ir, setIr] = useState<ImportIR | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  if (!open) return null;

  function reset() {
    setPhase("pick");
    setBusy(false);
    setError(null);
    setReport(null);
    setIr(null);
    setNames({});
    setExcluded(new Set());
  }

  function onClose() {
    reset();
    close();
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const picked = Array.from(fileList)
        .filter((f) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rel = (f as any).webkitRelativePath || f.name;
          return SCAN_EXT.test(rel) && !SKIP_DIR.test(rel) && f.size < 200_000;
        })
        .slice(0, MAX_FILES);
      const files = await Promise.all(
        picked.map(async (f) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          path: (f as any).webkitRelativePath || f.name,
          content: await f.text(),
        })),
      );
      if (files.length === 0) {
        setError("No source files found (looked for .ts/.tsx/.js/.py and similar).");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, name: "Imported System" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Import failed.");
        setBusy(false);
        return;
      }
      setReport(j.report as ImportReport);
      setIr(j.ir as ImportIR);
      setPhase("reviewing");
    } catch (err) {
      setError((err as Error)?.message ?? "Could not read the files.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!ir) return;
    setBusy(true);
    setError(null);
    try {
      // Apply review corrections to the IR: drop excluded agents (+ their flows/team membership),
      // and rename kept ones.
      const keptAgents: ImportedAgent[] = ir.agents
        .filter((a) => !excluded.has(a.id))
        .map((a) => ({ ...a, name: names[a.id]?.trim() || a.name }));
      const keptIds = new Set(keptAgents.map((a) => a.id));
      const editedIr: ImportIR = {
        ...ir,
        agents: keptAgents,
        flows: ir.flows.filter((f) => keptIds.has(f.from) && keptIds.has(f.to)),
        teams: ir.teams
          .map((t) => ({ ...t, memberIds: t.memberIds.filter((id) => keptIds.has(id)) }))
          .filter((t) => t.memberIds.length > 0),
      };
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ir: editedIr, name: "Imported System" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.pipeline) {
        setError(j.error ?? "Couldn't finalize the import.");
        setBusy(false);
        return;
      }
      const pipeline = pipelineSchema.parse(j.pipeline);
      setActivePipeline(pipeline, null);
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? "Couldn't finalize the import.");
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fm-fade-up relative flex max-h-full w-[560px] flex-col overflow-hidden rounded-2xl glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/15 text-violet">
              <FolderUp size={15} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-ink">Import existing code</div>
              <div className="text-[11px] text-ink-faint">Render your current AI system as a pipeline</div>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-faint transition hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Disclosure — static analysis, never sent to a model. */}
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-teal/25 bg-teal/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-ink-dim">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-teal" />
            Your code is analyzed by static analysis on the server only — it is <b className="text-ink">never sent to an AI model</b>,
            and only structure (agent names, models, prompts) is extracted, not file contents or secrets.
          </div>

          {error && <div className="mb-3 rounded-lg border border-red/30 bg-red/[0.06] px-3 py-2 text-[12px] text-ink">{error}</div>}

          {phase === "pick" && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-white/[0.02] px-4 py-10 text-center">
              <FolderUp size={22} className="text-ink-faint" />
              <p className="max-w-sm text-[12.5px] text-ink-dim">
                Choose your project folder. We scan TS/JS and Python for LLM calls (Anthropic, OpenAI, Vercel AI, LangChain, CrewAI) and the hand-rolled case.
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                // @ts-expect-error non-standard but widely supported directory upload
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={(e) => void onFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <FolderUp size={14} />} Choose folder
              </button>
            </div>
          )}

          {phase === "reviewing" && report && ir && (
            <div className="space-y-3">
              <div className={`rounded-xl border px-3 py-2.5 text-[12px] ${report.verdict === "none" ? "border-orange/30 bg-orange/[0.06]" : "border-line bg-white/[0.02]"}`}>
                <div className="font-medium text-ink">{report.verdict === "none" ? "No clear AI system found" : "Detected your AI system"}</div>
                <p className="mt-0.5 leading-relaxed text-ink-dim">{report.summary}</p>
              </div>

              {ir.agents.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    Detected nodes — rename or untick false positives
                  </div>
                  {ir.agents.map((a) => {
                    const isOut = excluded.has(a.id);
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${isOut ? "border-line/50 opacity-50" : "border-line"} bg-white/[0.02]`}
                      >
                        <input
                          type="checkbox"
                          checked={!isOut}
                          onChange={() =>
                            setExcluded((s) => {
                              const n = new Set(s);
                              if (n.has(a.id)) n.delete(a.id);
                              else n.add(a.id);
                              return n;
                            })
                          }
                          className="accent-violet"
                        />
                        <input
                          value={names[a.id] ?? a.name}
                          onChange={(e) => setNames((n) => ({ ...n, [a.id]: e.target.value }))}
                          disabled={isOut}
                          className="min-w-0 flex-1 rounded-md border border-line bg-black/30 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-line-strong disabled:opacity-50"
                        />
                        <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-ink-faint">{a.kind}</span>
                        {a.status === "unknown" ? (
                          <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-orange">
                            <AlertTriangle size={11} /> review
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10.5px] text-ink-faint">{Math.round(a.confidence * 100)}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {ir.notes.length > 0 && (
                <ul className="space-y-0.5 text-[11px] leading-relaxed text-ink-faint">
                  {ir.notes.map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {phase === "reviewing" && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <button onClick={reset} className="rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-dim transition hover:text-ink">
              Choose another folder
            </button>
            <button
              onClick={() => void accept()}
              disabled={busy || !ir || ir.agents.filter((a) => !excluded.has(a.id)).length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accept import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
