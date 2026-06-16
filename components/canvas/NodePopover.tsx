"use client";

import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Bot, FastForward, Loader2, RotateCw, Settings2, Users, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor, withAlpha } from "@/lib/ui/colors";
import { iconForNode } from "@/lib/ui/icons";
import { resolveTeamView } from "@/lib/pipeline/teamView";
import { descendantsOf } from "@/lib/pipeline/graph";
import { useAiAvailable } from "@/lib/ai/useAiAvailable";
import type { AgentConfig, PipelineNode } from "@/lib/pipeline/schema";
import { ExplainButton } from "./ExplainButton";

const W = 300;

export function NodePopover() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const inspectorOpen = usePipelineStore((s) => s.inspectorOpen);
  const teamPath = usePipelineStore((s) => s.teamPath);
  const selectNode = usePipelineStore((s) => s.selectNode);

  const pathKey = teamPath.join(">");

  if (!pipeline || !selectedNodeId || inspectorOpen) return null;

  // Resolve the selected entity for the current level.
  if (teamPath.length === 0) {
    const node = pipeline.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;
    return <Popover key={node.id} node={node} pathKey={pathKey} onClose={() => selectNode(null)} />;
  }

  const view = resolveTeamView(pipeline, teamPath);
  const teamId = view.crumbs[view.crumbs.length - 1]?.id;
  const agent = view.team?.agents.find((a) => a.id === selectedNodeId);
  if (!agent || !teamId) return null;
  return <Popover key={agent.id} agent={agent} teamId={teamId} pathKey={pathKey} onClose={() => selectNode(null)} />;
}

function useAnchor(targetId: string, pathKey: string) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(targetId)}"]`);
    let next: { top: number; left: number } | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      const GAP = 14;
      const preferLeft = window.innerWidth - r.right < W + GAP + 380;
      let left = preferLeft ? r.left - GAP - W : r.right + GAP;
      left = Math.min(Math.max(left, 12), window.innerWidth - W - 12);
      const top = Math.max(12, Math.min(r.top, window.innerHeight - 220));
      next = { top, left };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- anchoring to an external React Flow node requires a post-layout measurement
    setAnchor(next);
  }, [targetId, pathKey]);
  return anchor;
}

function Popover({
  node,
  agent,
  teamId,
  pathKey,
  onClose,
}: {
  node?: PipelineNode;
  agent?: AgentConfig;
  teamId?: string;
  pathKey: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const targetId = (node?.id ?? agent?.id)!;
  const anchor = useAnchor(targetId, pathKey);

  // Close on click outside the popover (but let canvas node/pane clicks manage selection).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t)) return;
      if (t.closest(".react-flow__node") || t.closest(".react-flow__pane")) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  if (!anchor) return null;

  if (node?.team) return <TeamSummary node={node} style={{ top: anchor.top, left: anchor.left }} popRef={ref} onClose={onClose} />;
  return (
    <NodeDetail
      node={node}
      agent={agent}
      teamId={teamId}
      style={{ top: anchor.top, left: anchor.left }}
      popRef={ref}
      onClose={onClose}
    />
  );
}

/* ── Team folder summary ─────────────────────────────────────────────────── */

function TeamSummary({
  node,
  style,
  popRef,
  onClose,
}: {
  node: PipelineNode;
  style: React.CSSProperties;
  popRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const enterTeam = usePipelineStore((s) => s.enterTeam);
  const openInspector = usePipelineStore((s) => s.openInspector);
  const accent = hexFor({ color: node.color, type: node.type });
  const members = node.team!.agents.filter((a) => !a.isController);
  const controllers = node.team!.agents.filter((a) => a.isController);

  return (
    <Shell style={style} popRef={popRef}>
      <Header accent={accent} icon={Users} title={node.title} subtitle={`team · ${node.team!.strategy}`} onSettings={() => openInspector(node.id)} onClose={onClose} />
      {node.role && <p className="mt-2.5 text-[12px] leading-relaxed text-ink-dim">{node.role}</p>}

      <div className="mt-3 space-y-2">
        <Pills label="Inputs" items={node.inputs} accent={accent} dim />
        <Pills label="Outputs" items={node.outputs} accent={accent} />
      </div>

      <div className="mt-3.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        {members.length} member{members.length === 1 ? "" : "s"}
        {controllers.length ? ` · ${controllers.length} controller${controllers.length === 1 ? "" : "s"}` : ""}
      </div>
      <div className="mt-1.5 max-h-[220px] space-y-1 overflow-y-auto pr-0.5">
        {members.map((a) => (
          <div key={a.id} className="rounded-lg border border-line bg-white/[0.02] px-2.5 py-1.5">
            <div className="truncate text-[12px] text-ink">{a.name || a.id}</div>
            {a.role && <div className="truncate text-[10.5px] text-ink-faint">{a.role}</div>}
          </div>
        ))}
        {controllers.map((a) => (
          <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-violet/25 bg-violet/[0.05] px-2.5 py-1.5">
            <span className="truncate text-[12px] text-ink">{a.name || a.id}</span>
            <span className="rounded bg-violet/20 px-1 text-[9px] capitalize text-violet">{a.controllerKind ?? "controller"}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => enterTeam(node.id)}
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg bg-violet py-2 text-[13px] font-medium text-white transition hover:bg-violet/90"
      >
        <Users size={14} /> Open team
      </button>
    </Shell>
  );
}

/* ── Regular node / agent detail (What came in · Prompt · What went out) ───── */

function NodeDetail({
  node,
  agent,
  teamId,
  style,
  popRef,
  onClose,
}: {
  node?: PipelineNode;
  agent?: AgentConfig;
  teamId?: string;
  style: React.CSSProperties;
  popRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const steps = usePipelineStore((s) => s.steps);
  const agentRunTraces = usePipelineStore((s) => s.agentRunTraces);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const setNodePrompt = usePipelineStore((s) => s.setNodePrompt);
  const setAgentPrompt = usePipelineStore((s) => s.setAgentPrompt);
  const openInspector = usePipelineStore((s) => s.openInspector);
  const runPipeline = usePipelineStore((s) => s.runPipeline);
  const runSoloAgent = usePipelineStore((s) => s.runSoloAgent);
  const aiAvailable = useAiAvailable();

  const isAgent = Boolean(agent);
  const accent = isAgent
    ? hexFor({ color: agent!.isController ? "violet" : "blue", type: "agent" })
    : hexFor({ color: node!.color, type: node!.type });
  const title = node?.title ?? agent?.name ?? agent?.id ?? "Node";
  const typeLabel = isAgent
    ? agent!.isController
      ? `controller · ${agent!.controllerKind ?? "controller"}`
      : "agent"
    : node!.type;
  const role = node?.role || agent?.role || "";

  const step = node ? steps.find((s) => s.nodeId === node.id) : undefined;
  const trace = agent && teamId ? [...agentRunTraces].reverse().find((t) => t.teamNodeId === teamId && t.agentId === agent.id) : undefined;

  const inputKeys = node?.inputs ?? [];
  const outputKeys = node?.outputs ?? [];
  const inputVal = node ? step?.input : trace?.input;
  const outputVal = node ? step?.output : trace?.output;

  const [prompt, setPrompt] = useState(node?.prompt ?? agent?.prompt ?? "");
  const savePrompt = () => {
    const orig = node?.prompt ?? agent?.prompt ?? "";
    if (prompt === orig) return;
    if (node) setNodePrompt(node.id, prompt);
    else if (agent && teamId) setAgentPrompt(teamId, agent.id, prompt);
  };

  const rerun = () => {
    if (node) void runPipeline({ onlyNodeId: node.id });
    else if (agent && teamId) void runSoloAgent(teamId, agent.id);
  };

  const icon = node ? iconForNode(node) : Bot;
  const running = runStatus === "running";
  const downstreamCount = node && pipeline ? descendantsOf(pipeline, node.id).size - 1 : 0;

  return (
    <Shell style={style} popRef={popRef}>
      <Header accent={accent} icon={icon} title={title} subtitle={role ? `${typeLabel} · ${role}` : typeLabel} onSettings={node ? () => openInspector(node.id) : undefined} onClose={onClose} />

      <Section icon={ArrowDownToLine} label="What came in" accent={accent}>
        <DataBlock value={inputVal} keys={inputKeys} accent={accent} />
      </Section>

      <div className="mt-3">
        <SectionLabel label="Prompt" />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={savePrompt}
          rows={4}
          placeholder={isAgent ? "What should this agent do?" : "What should this node do?"}
          className="mt-1.5 w-full resize-none rounded-lg border border-line bg-black/30 p-2.5 text-[12.5px] leading-relaxed text-ink outline-none focus:border-line-strong"
        />
      </div>

      <Section icon={ArrowUpFromLine} label="What went out" accent={accent}>
        <DataBlock value={outputVal} keys={outputKeys} accent={accent} />
      </Section>

      {(step?.summary || trace?.outputSummary) && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-ink-faint">{step?.summary || trace?.outputSummary}</p>
      )}

      <div className="mt-3.5 space-y-2.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={rerun}
            disabled={running}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong bg-white/[0.04] py-2 text-[12.5px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
            {isAgent ? "Re-run agent" : "Re-run node"}
          </button>
          {node && !isAgent && (
            <button
              type="button"
              onClick={() => void runPipeline({ fromNodeId: node.id })}
              disabled={running}
              title={
                downstreamCount > 0
                  ? `Re-run this node and ${downstreamCount} downstream node${downstreamCount === 1 ? "" : "s"}, seeding upstream from the last run`
                  : "Re-run this node, seeding upstream from the last run"
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong bg-white/[0.04] py-2 text-[12.5px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
            >
              <FastForward size={14} />
              Replay from here{downstreamCount > 0 ? ` · ${downstreamCount}` : ""}
            </button>
          )}
        </div>
        {node && aiAvailable && <ExplainButton scope="node" focusId={node.id} />}
      </div>
    </Shell>
  );
}

/* ── Shared pieces ─────────────────────────────────────────────────────────── */

function Shell({ style, popRef, children }: { style: React.CSSProperties; popRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  return (
    <div
      ref={popRef}
      style={{ ...style, width: W }}
      className="fixed z-40 rounded-2xl p-3.5 glass-strong fm-fade-up shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
    >
      {children}
    </div>
  );
}

function Header({
  accent,
  icon,
  title,
  subtitle,
  onSettings,
  onClose,
}: {
  accent: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  onSettings?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: withAlpha(accent, 0.16), color: accent }}>
        {createElement(icon, { size: 16, strokeWidth: 1.9 })}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{title}</div>
        <div className="truncate text-[11px] capitalize text-ink-faint">{subtitle}</div>
      </div>
      {onSettings && (
        <button onClick={onSettings} title="Edit details" className="shrink-0 text-ink-faint transition hover:text-ink">
          <Settings2 size={14} />
        </button>
      )}
      <button onClick={onClose} aria-label="Close" className="shrink-0 text-ink-faint transition hover:text-ink">
        <X size={15} />
      </button>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>;
}

function Section({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5" style={{ color: withAlpha(accent, 0.9) }}>
        {createElement(icon, { size: 11 })}
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{label}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Pills({ label, items, accent, dim }: { label: string; items: string[]; accent: string; dim?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-12 shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span
            key={i}
            className="rounded-md px-1.5 py-[2px] font-mono text-[10px]"
            style={{ background: dim ? "#ffffff0d" : withAlpha(accent, 0.12), color: dim ? "#a6a7ba" : accent }}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Shows real run values when present; otherwise the declared key names as chips. */
function DataBlock({ value, keys, accent }: { value: unknown; keys: string[]; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  const empty = value === undefined || value === null || value === "";

  if (empty) {
    if (!keys.length) return <span className="text-[11.5px] text-ink-faint">Run to see values.</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {keys.map((k) => (
          <span key={k} className="rounded-md px-1.5 py-[2px] font-mono text-[10.5px]" style={{ background: withAlpha(accent, 0.12), color: accent }}>
            {k}
          </span>
        ))}
      </div>
    );
  }

  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const long = text.length > 320;
  const shown = expanded || !long ? text : `${text.slice(0, 320)}…`;

  return (
    <div className="rounded-lg border border-line bg-black/20 p-2">
      {typeof value === "string" ? (
        <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink-dim">{shown}</p>
      ) : (
        <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-dim">{shown}</pre>
      )}
      {long && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[10.5px] font-medium text-violet">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
