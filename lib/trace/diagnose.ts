import type { Pipeline, RunStep, RunTrace } from "@/lib/pipeline/schema";

/**
 * Dual-mode chat (Prompt 19a) — intent routing + non-mutating diagnostics.
 *
 * In EDIT mode every chat message is classified as either an **edit request** (an imperative change
 * to the graph → routed to the edit-diff flow) or a **diagnostic question** (a question about how the
 * pipeline is doing → answered in plain English, pointing at specific nodes, and NEVER mutating the
 * graph). When intent is ambiguous we default to diagnostic — the safe, non-destructive path.
 *
 * Diagnostics are computed deterministically from local run/trace state (no AI call), so they're
 * instant, free, and always cite real nodes.
 */

export type ChatIntent = "edit" | "diagnostic";

// Imperative verbs that signal a change to the graph.
const EDIT_VERBS =
  /\b(add|remove|delete|drop|make|change|rename|replace|swap|split|merge|combine|wire|connect|route|parallelize|decompose|insert|turn (?:it|this) into|give (?:it|this)|set|use|switch|convert|increase|reduce|simplify|expand|rework|refactor|upgrade|downgrade)\b/i;

// Question / inspection openers that signal a diagnostic.
const DIAGNOSTIC_OPENERS =
  /^(why|what|which|who|how|where|when|is|are|does|do|did|can|could|should|explain|describe|tell me|show me|debug|diagnose|help me understand)\b/i;
const DIAGNOSTIC_TOPICS =
  /\b(slow|latency|cost|expensive|failing|failed|error|wrong|weak|bad|broken|not working|results?|output|quality|confidence|bottleneck|stuck)\b/i;

/** Classify a chat message in edit mode. Ambiguous → diagnostic (safe, never mutates). */
export function classifyIntent(message: string): ChatIntent {
  const m = message.trim();
  if (!m) return "diagnostic";
  const looksDiagnostic = DIAGNOSTIC_OPENERS.test(m) || (m.endsWith("?") && !EDIT_VERBS.test(m)) || DIAGNOSTIC_TOPICS.test(m);
  const looksEdit = EDIT_VERBS.test(m) && !m.endsWith("?");
  if (looksEdit && !DIAGNOSTIC_OPENERS.test(m)) return "edit";
  if (looksDiagnostic) return "diagnostic";
  // Bare imperative with no question signal → treat as an edit; otherwise diagnostic.
  return EDIT_VERBS.test(m) ? "edit" : "diagnostic";
}

function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** A compact one-line summary of the graph + last run, for the edit-mode header. */
export function summarizePipeline(pipeline: Pipeline | null, run: RunTrace | null): string {
  if (!pipeline) return "";
  const nodes = pipeline.nodes.length;
  const teamNodes = pipeline.nodes.filter((n) => n.team && (n.team.agents?.length ?? 0) > 0).length;
  const parts = [`${nodes} node${nodes === 1 ? "" : "s"}`];
  if (teamNodes > 0) parts.push(`${teamNodes} team node${teamNodes === 1 ? "" : "s"}`);
  const rel = relativeTime(run?.finishedAt || run?.startedAt);
  parts.push(rel ? `last run ${rel}` : "not run yet");
  return parts.join(" · ");
}

function nodeTitle(pipeline: Pipeline, nodeId: string): string {
  return pipeline.nodes.find((n) => n.id === nodeId)?.title ?? nodeId;
}

/**
 * Answer a diagnostic question from local run/trace state. Returns a plain-English explanation that
 * cites specific nodes. Never mutates anything. If there's no run yet, says so plainly.
 */
export function diagnosePipeline(
  pipeline: Pipeline | null,
  run: RunTrace | null,
  steps: RunStep[],
  message: string,
): string {
  if (!pipeline) return "There's no pipeline on the canvas yet — describe one to get started.";
  const m = message.toLowerCase();
  const hasRun = Boolean(run || steps.length);

  if (!hasRun) {
    return `This pipeline has ${pipeline.nodes.length} nodes but hasn't been run yet, so there's no trace to debug. Hit Run to execute it on real Claude — then ask me again and I'll point at the specific nodes.`;
  }

  const liveSteps = steps.length ? steps : run?.steps ?? [];
  const failed = liveSteps.filter((s) => s.status === "error");

  // Failures take priority regardless of the question.
  if (failed.length) {
    const names = failed.map((s) => `"${s.title}"`).join(", ");
    return `${failed.length} node${failed.length === 1 ? "" : "s"} failed on the last run: ${names}. Start there — open ${failed.length === 1 ? "that node" : "the first one"} to see its input and error, since everything downstream depends on it.`;
  }

  // "Slow / latency" — name the slowest step.
  if (/\bslow|latency|fast|speed|bottleneck|time\b/.test(m)) {
    const slowest = [...liveSteps].sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0];
    if (slowest) {
      const secs = ((slowest.durationMs ?? 0) / 1000).toFixed(1);
      const total = run?.latencyMs ? `${(run.latencyMs / 1000).toFixed(1)}s total` : "";
      return `The slowest step was "${slowest.title}" at ${secs}s${total ? ` (${total})` : ""}. If it's a team node, a parallel strategy or a faster model on its workers would cut the most time.`;
    }
  }

  // "Cost / expensive" — name the costliest step + total.
  if (/\bcost|expensive|cheap|price|spend|token\b/.test(m)) {
    const withCost = liveSteps.filter((s) => typeof s.costUsd === "number");
    const costliest = [...withCost].sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0))[0];
    const total = run?.costUsd != null ? `$${run.costUsd.toFixed(3)} total` : "cost not recorded";
    if (costliest) {
      return `Last run was ${total}. The costliest node was "${costliest.title}" ($${(costliest.costUsd ?? 0).toFixed(3)}). Dropping it to a smaller model — or to Tight effort — is the biggest lever.`;
    }
    return `Last run was ${total}.`;
  }

  // "Weak / wrong / quality results" — cite low-confidence teams, packet + contract warnings.
  if (/\bweak|wrong|bad|quality|results?|output|confidence|accurate|trust|hallucinat/.test(m)) {
    const cues: string[] = [];
    const lowConf = liveSteps.filter((s) => typeof s.confidence === "number" && (s.confidence as number) < 0.7);
    if (lowConf.length) cues.push(`low confidence at ${lowConf.map((s) => `"${s.title}"`).join(", ")}`);
    const packetWarnings = (run?.packets ?? []).flatMap((p) => (p.warnings ?? []).map((w) => ({ to: p.toNodeId, w })));
    if (packetWarnings.length) {
      const first = packetWarnings[0];
      cues.push(`a handoff warning into "${first.to ? nodeTitle(pipeline, first.to) : "a downstream node"}" (${first.w})`);
    }
    const contractWarnings = pipeline.edges.filter((e) => (e.contract?.warnings?.length ?? 0) > 0);
    if (contractWarnings.length) {
      const e = contractWarnings[0];
      cues.push(`a data-contract mismatch on the edge into "${nodeTitle(pipeline, e.target)}"`);
    }
    if (cues.length) {
      return `A few things to look at: ${cues.join("; ")}. Open those nodes to inspect what came in vs. what went out — that's usually where weak results originate. Want me to propose a fix? Say "add a critic after <node>" or "make <node> smarter".`;
    }
    return `Nothing failed and confidence looks healthy on the last run. If the result still feels off, the prompt on the node that writes the final output is the place to tighten — open it and tell me what to change.`;
  }

  // Generic — summarize the run and point them at where to look.
  const slowest = [...liveSteps].sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0];
  const teamNodes = pipeline.nodes.filter((n) => n.team).length;
  return `This pipeline ran ${liveSteps.length} step${liveSteps.length === 1 ? "" : "s"}${teamNodes ? ` across ${teamNodes} team node${teamNodes === 1 ? "" : "s"}` : ""}${slowest ? `, with "${slowest.title}" taking the longest` : ""}. Ask me about cost, speed, or weak results and I'll point at the specific node — or tell me a change to make and I'll propose a reviewable diff.`;
}
