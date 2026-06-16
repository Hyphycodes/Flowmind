"use client";

import { useEffect, useState } from "react";
import { Brain, Plus, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { activePatterns } from "@/lib/preferences/schema";
import { cn } from "@/lib/ui/cn";

/** "How Flowmind builds for you" — the learned + explicit patterns made visible and editable.
 *  Nothing is hidden; you can forget any pattern or add an explicit one (explicit beats observed). */
export function BuilderPreferencesPanel() {
  const preferences = usePipelineStore((s) => s.preferences);
  const hydratePreferences = usePipelineStore((s) => s.hydratePreferences);
  const forgetPreference = usePipelineStore((s) => s.forgetPreference);
  const addExplicitPreference = usePipelineStore((s) => s.addExplicitPreference);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!preferences) void hydratePreferences();
  }, [preferences, hydratePreferences]);

  const patterns = preferences?.patterns ?? [];
  const activeIds = new Set((preferences ? activePatterns(preferences) : []).map((p) => p.id));
  const d = preferences?.defaults;

  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <h2 className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        <Brain size={13} className="text-violet" /> How Flowmind builds for you
      </h2>
      <p className="mb-3 text-[12px] leading-relaxed text-ink-faint">
        Patterns Flowmind learned from how you build, plus ones you set. They gently nudge generation and edits —
        explicit beats observed, and you can forget any of them.
      </p>

      {patterns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-ink-faint">
          Nothing yet. As you repeatedly apply the same kind of change — adding a critic, routing a node to a cheaper
          model — it shows up here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {patterns.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                activeIds.has(p.id) ? "border-violet/30 bg-violet/[0.04]" : "border-line bg-white/[0.02]",
              )}
            >
              <span className="min-w-0 flex-1 text-[12.5px] text-ink">{p.statement}</span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-medium capitalize",
                  p.source === "explicit" ? "bg-violet/20 text-violet" : "bg-white/[0.06] text-ink-faint",
                )}
              >
                {p.source}
                {p.source === "observed" ? ` ·${Math.round(p.weight)}` : ""}
              </span>
              <button onClick={() => forgetPreference(p.id)} title="Forget this" className="shrink-0 text-ink-faint transition hover:text-red">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {d && (d.lightModelPref || d.heavyModelPref || d.defaultEffort) && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {d.lightModelPref && <Tag label={`light → ${d.lightModelPref.replace("claude-", "")}`} />}
          {d.heavyModelPref && <Tag label={`heavy → ${d.heavyModelPref.replace("claude-", "")}`} />}
          {d.defaultEffort && <Tag label={`effort → ${d.defaultEffort}`} />}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            addExplicitPreference(draft);
            setDraft("");
          }
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a preference, e.g. Always use the fast model for extraction"
          className="flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-lg bg-violet px-3 text-[12.5px] font-medium text-white transition hover:bg-violet/90 disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </form>
    </section>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-md border border-line bg-white/[0.03] px-2 py-1 font-mono text-ink-dim">{label}</span>;
}
