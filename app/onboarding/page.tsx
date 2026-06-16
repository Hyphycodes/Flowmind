"use client";

import { useState } from "react";
import {
  ArrowRight,
  Boxes,
  Check,
  Database,
  Layers3,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ACCENT_HEX, withAlpha, type Accent } from "@/lib/ui/colors";
import { cn } from "@/lib/ui/cn";

type UseCase = { id: string; label: string; desc: string; template: string; accent: Accent };

const USE_CASES: UseCase[] = [
  { id: "agent_system", label: "AI Agent System", desc: "Teams of agents that hand off work.", template: "tpl-jarvis", accent: "violet" },
  { id: "assistant", label: "Personal Assistant", desc: "Taste-aware planning + recommendations.", template: "tpl-jarvis", accent: "violet" },
  { id: "real_estate", label: "Real Estate Deal Analyzer", desc: "Comps, ARV, repairs, deal score.", template: "tpl-real-estate", accent: "gold" },
  { id: "content", label: "Content Studio", desc: "Hooks, scripts, captions, posting plan.", template: "tpl-content", accent: "pink" },
  { id: "inbox", label: "Inbox Operator", desc: "Triage, draft, schedule, approve.", template: "tpl-inbox", accent: "cyan" },
  { id: "research", label: "Research Engine", desc: "Sources, credibility, thesis report.", template: "tpl-research", accent: "teal" },
  { id: "sales", label: "Sales Agent", desc: "Qualify, enrich, write outreach.", template: "tpl-sales", accent: "blue" },
  { id: "custom", label: "Custom", desc: "Start from a blank canvas.", template: "blank", accent: "slate" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [finishing, setFinishing] = useState(false);

  const finish = async (template: string, useCaseId?: string) => {
    setFinishing(true);
    try {
      localStorage.setItem("flowmind_onboarding", JSON.stringify({ completed: true, useCase: useCaseId, template, at: Date.now() }));
    } catch {
      /* ignore */
    }
    await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useCase: useCaseId, templateId: template }),
    }).catch(() => {});
    window.location.href = template === "blank" ? "/editor?new=1" : `/editor?template=${template}`;
  };

  return (
    <div className="flow-canvas flex min-h-screen w-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full transition", i <= step ? "bg-violet" : "bg-white/10")} />
          ))}
        </div>

        {step === 0 && (
          <div className="fm-fade-up rounded-2xl p-7 glass-strong">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white/[0.03]">
              <Sparkles className="text-violet" size={20} />
            </div>
            <h1 className="font-display text-[32px] italic leading-tight text-ink">Welcome to Flowmind</h1>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-dim">
              Describe an AI product and Flowmind builds the whole system — then lets you inspect,
              remix, and ship it.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <Feature icon={Boxes} label="Agent teams" accent="#8b5cf6" />
              <Feature icon={Database} label="Generated data" accent="#22d3ee" />
              <Feature icon={Layers3} label="Preview + export" accent="#ec4899" />
            </div>
            <button
              onClick={() => setStep(1)}
              className="mt-6 flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
            >
              Get started <ArrowRight size={15} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="fm-fade-up rounded-2xl p-6 glass-strong">
            <h2 className="font-display text-[24px] italic text-ink">What do you want to build?</h2>
            <p className="mt-1 text-[12.5px] text-ink-dim">Pick a starting point — you can change everything later.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {USE_CASES.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setUseCase(u);
                    setStep(2);
                  }}
                  className="group flex items-start gap-2.5 rounded-xl border border-line bg-white/[0.02] p-3 text-left transition hover:border-line-strong hover:bg-white/[0.04]"
                  style={{ background: `linear-gradient(180deg, ${withAlpha(ACCENT_HEX[u.accent], 0.05)}, rgba(255,255,255,0.02))` }}
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT_HEX[u.accent] }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{u.label}</span>
                    <span className="block text-[11.5px] leading-snug text-ink-faint">{u.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && useCase && (
          <div className="fm-fade-up rounded-2xl p-6 glass-strong">
            <h2 className="font-display text-[24px] italic text-ink">How do you want to start?</h2>
            <p className="mt-1 text-[12.5px] text-ink-dim">
              {useCase.label} · you can connect live sources anytime.
            </p>

            <div className="mt-4 space-y-2.5">
              <button
                onClick={() => void finish(useCase.template, useCase.id)}
                disabled={finishing}
                className="flex w-full items-center gap-3 rounded-xl border border-violet/40 bg-violet/[0.08] p-3.5 text-left transition hover:bg-violet/[0.14] disabled:opacity-60"
              >
                <Database size={18} className="shrink-0 text-violet" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">Use demo / Input Studio data</span>
                  <span className="block text-[11.5px] text-ink-faint">Strong reusable seed data — no keys needed. Recommended.</span>
                </span>
                {finishing ? <Loader2 size={15} className="animate-spin text-violet" /> : <ArrowRight size={15} className="text-violet" />}
              </button>

              <a
                href="/api/google/connect"
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5 text-left transition hover:bg-white/[0.04]"
              >
                <Link2 size={18} className="shrink-0 text-ink-dim" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">Connect Google Drive</span>
                  <span className="block text-[11.5px] text-ink-faint">
                    Optional. Let nodes use files you select. Separate from sign-in — you can skip this.
                  </span>
                </span>
              </a>

              <button
                onClick={() => void finish("blank", useCase.id)}
                disabled={finishing}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5 text-left transition hover:bg-white/[0.04] disabled:opacity-60"
              >
                <Sparkles size={18} className="shrink-0 text-ink-dim" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">Start from a blank canvas</span>
                  <span className="block text-[11.5px] text-ink-faint">Describe your own system in the command bar.</span>
                </span>
              </button>
            </div>

            <button onClick={() => setStep(1)} className="mt-5 text-[12px] text-ink-faint transition hover:text-ink">
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label, accent }: { icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; label: string; accent: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3 text-center">
      <Icon size={18} className="mx-auto" style={{ color: accent }} />
      <div className="mt-1.5 text-[11.5px] text-ink-dim">{label}</div>
      <Check size={11} className="mx-auto mt-1 text-green" />
    </div>
  );
}
