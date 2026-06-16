"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Play } from "lucide-react";
import type { RunAppManifest } from "@/lib/sharing/manifest";
import type { FinalOutput, OutputTable } from "@/lib/pipeline/schema";
import { formatCell } from "@/lib/ui/format";

/** The Run-App surface — a calm, near-whitelabel page. Receives ONLY the stripped manifest; runs
 *  execute server-side and return results-only. Nothing here can reveal prompts/sources/internals. */
export function RunAppClient({ manifest, token }: { manifest: RunAppManifest; token: string }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(manifest.fields.map((f) => [f.key, ""])),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ finalOutput?: FinalOutput; tables: OutputTable[] } | null>(null);

  const canRun = manifest.level === "run" || manifest.level === "edit";

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/run-app/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: values }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Run failed.");
        return;
      }
      setResult({ finalOutput: j.finalOutput, tables: Array.isArray(j.tables) ? j.tables : [] });
    } catch (e) {
      setError((e as Error)?.message ?? "Run failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070c] px-5 py-10 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold leading-tight">{manifest.name}</h1>
            {manifest.description && <p className="mt-1 text-[12.5px] text-ink-dim">{manifest.description}</p>}
          </div>
          <span className="shrink-0 font-display text-[15px] italic text-ink-faint">flowmind</span>
        </header>

        {manifest.level === "view" ? (
          <ViewSurface manifest={manifest} />
        ) : (
          <section className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <div className="space-y-3">
              {manifest.fields.length > 0 ? (
                manifest.fields.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-[11.5px] text-ink-dim">{f.label}</span>
                    <input
                      value={values[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
                    />
                  </label>
                ))
              ) : (
                <p className="text-[12px] text-ink-faint">No inputs needed — just run it.</p>
              )}
              <button
                onClick={run}
                disabled={running || !canRun}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-50"
              >
                {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} className="fill-current" />}
                Run
              </button>
              {error && <p className="text-[12px] text-red">{error}</p>}
            </div>
          </section>
        )}

        {manifest.level === "edit" && (
          <Link
            href={`/editor?open=${manifest.pipelineId}`}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-violet transition hover:underline"
          >
            Open the full editor <ArrowRight size={13} />
          </Link>
        )}

        {result && <Results finalOutput={result.finalOutput} tables={result.tables} />}

        <p className="mt-8 text-center text-[11px] text-ink-faint">
          Powered by Flowmind — you&apos;re running a shared app. Prompts and data sources stay private.
        </p>
      </div>
    </div>
  );
}

function Results({ finalOutput, tables }: { finalOutput?: FinalOutput; tables: OutputTable[] }) {
  return (
    <div className="mt-5 space-y-4">
      {finalOutput && (
        <section className="rounded-2xl border border-line bg-gradient-to-b from-white/[0.05] to-transparent p-4">
          <h2 className="text-[16px] font-semibold leading-tight text-ink">{finalOutput.title}</h2>
          {finalOutput.summary && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-dim">{finalOutput.summary}</p>}
          {finalOutput.highlights?.length ? (
            <div className="mt-3 space-y-0.5">
              {finalOutput.highlights.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-line/40 py-1.5 last:border-0">
                  <span className="text-[12.5px] text-ink-dim">{h.label}</span>
                  <span className="text-right text-[12.5px] font-medium text-ink">{h.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}
      {tables
        .filter((t) => t.rows.length > 0)
        .map((t) => (
          <section key={t.id} className="overflow-hidden rounded-2xl border border-line bg-white/[0.02]">
            <div className="border-b border-line px-3.5 py-2 text-[12px] font-medium text-ink">{t.name}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="border-b border-line text-ink-faint">
                    {(t.columns.length ? t.columns : Object.keys(t.rows[0] ?? {}).map((k) => ({ key: k, label: k, type: "text" as const }))).map((c) => (
                      <th key={c.key} className="px-3 py-1.5 text-left font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.slice(0, 50).map((row, i) => {
                    const cols = t.columns.length ? t.columns : Object.keys(row).map((k) => ({ key: k, label: k, type: "text" as const }));
                    return (
                      <tr key={i} className="border-b border-line/50 last:border-0">
                        {cols.map((c) => (
                          <td key={c.key} className="px-3 py-1.5 text-ink-dim">{formatCell(row[c.key], c.type)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  );
}

function ViewSurface({ manifest }: { manifest: RunAppManifest }) {
  const structure = manifest.structure;
  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-5">
      <p className="mb-3 text-[12px] text-ink-faint">View only — you can see the structure, not run or edit it.</p>
      {structure ? (
        <div className="space-y-1.5">
          {structure.nodes.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-lg border border-line bg-white/[0.02] px-3 py-2">
              <span className="text-[12.5px] text-ink">{n.title}</span>
              <span className="text-[10.5px] capitalize text-ink-faint">{n.type}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-ink-faint">No structure to show.</p>
      )}
    </section>
  );
}
