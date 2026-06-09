"use client";

import { Filter, Gauge, MessageSquareText, Sparkles, Target, Users, Wrench } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ACCENT_HEX, withAlpha, type Accent } from "@/lib/ui/colors";

const TYPES: { label: string; desc: string; icon: typeof Target; accent: Accent }[] = [
  { label: "Input", desc: "Collects the data your pipeline starts from.", icon: Target, accent: "blue" },
  { label: "Agent", desc: "An LLM step with a role and a prompt it runs.", icon: Sparkles, accent: "violet" },
  { label: "Tool", desc: "A deterministic call — search, fetch, compute.", icon: Wrench, accent: "cyan" },
  { label: "Transformer", desc: "Reshapes or merges data between steps.", icon: Filter, accent: "teal" },
  { label: "Evaluator", desc: "Scores, ranks, or gates results.", icon: Gauge, accent: "gold" },
  { label: "Output", desc: "Produces the final result and UI bindings.", icon: MessageSquareText, accent: "pink" },
];

export default function LibraryPage() {
  return (
    <PageShell title="Library" subtitle="Building blocks for your pipelines">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TYPES.map((t) => {
          const hex = ACCENT_HEX[t.accent];
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-2xl border border-line bg-white/[0.02] p-4">
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: withAlpha(hex, 0.16), color: hex }}
              >
                <Icon size={17} strokeWidth={1.9} />
              </div>
              <h3 className="text-[14px] font-medium text-ink">{t.label}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{t.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 max-w-3xl rounded-2xl border border-violet/30 bg-violet/[0.05] p-5">
        <div className="flex items-center gap-2 text-ink">
          <Users size={16} className="text-violet" />
          <h3 className="text-[14px] font-medium">Teams of agents</h3>
          <span className="rounded-full border border-violet/40 px-2 py-0.5 text-[10px] text-violet">
            coming soon
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">
          Every node can become a <em>team</em> — multiple agents collaborating with a strategy
          (sequential, parallel, router, debate, or vote). The schema already supports it
          (<code className="font-mono text-[11px]">node.team</code>); multi-agent execution is the
          next milestone.
        </p>
      </div>
    </PageShell>
  );
}
