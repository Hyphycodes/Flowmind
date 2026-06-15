import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel } from "@/lib/ai/anthropic";
import { TOOLS } from "@/lib/tools/registry";
import { isToolReady } from "@/lib/tools/status";
import {
  ACCENTS,
  COMPONENT_TYPES,
  TEAM_STRATEGIES,
  type ComponentType,
  type Pipeline,
  type TeamStrategy,
} from "./schema";
import { repairPipeline } from "./validate";
import type { EffortLevel } from "./effort";

/* ── Effort dial ──────────────────────────────────────────────────────────
 * The effort setting is a parameter to the Architect, not a separate prompt. It
 * sizes the design: tight = one clean chain; balanced = a few nodes + small
 * teams; deep = richer structure with parallel/debate/vote and nested teams.
 * The levels/labels live in the dependency-free `./effort` so the client can
 * import them; the prompt sizing (EFFORT_GUIDE) stays here, server-side. */

export type { EffortLevel } from "./effort";

/* ── Generation schema (the Architect's JSON vocabulary) ──────────────────
 * Mirrors the documented Architect contract: a node has a `kind`, an input node
 * carries `fields`, an output node carries `display`, and a team carries a
 * `strategy` + `members`. We map this into Flowmind's canonical schema below. */

const leafAgentSchema = z.object({
  id: z.string().describe("unique snake_case id"),
  kind: z.enum(["agent", "tool", "transformer", "evaluator"]).default("agent"),
  title: z.string(),
  role: z.string().optional().describe("one short line: this member's job"),
  prompt: z
    .string()
    .optional()
    .describe("second-person instruction naming the inputs it uses and the output it produces"),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
});

const teamMemberSchema = leafAgentSchema.extend({
  // a member may itself be a small sub-team (one level deep); we flatten it into the crew
  strategy: z.enum(TEAM_STRATEGIES).optional(),
  members: z.array(leafAgentSchema).optional().describe("only for a nested sub-team (deep effort)"),
});

const inputFieldSchema = z.object({
  name: z.string().describe("snake_case field key"),
  label: z.string(),
  type: z.string().optional().default("text"),
});

const displayItemSchema = z.object({
  label: z.string().describe("what the user sees"),
  from: z.string().describe("an upstream output key to show"),
  component: z.enum(COMPONENT_TYPES).optional().describe("optional UI component hint"),
});

const nodeSchema = z.object({
  id: z.string().describe("unique snake_case id"),
  kind: z.enum(["input", "agent", "tool", "transformer", "evaluator", "output", "team"]),
  title: z.string(),
  role: z.string().optional(),
  prompt: z.string().optional(),
  color: z.enum(ACCENTS).optional(),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  fields: z.array(inputFieldSchema).optional().describe("input node: the starting values to collect"),
  display: z.array(displayItemSchema).optional().describe("output node: the fields the UI shows"),
  strategy: z.enum(TEAM_STRATEGIES).optional().describe("team node: coordination strategy"),
  members: z.array(teamMemberSchema).optional().describe("team node: the agents inside"),
});

const genSchema = z.object({
  name: z.string(),
  summary: z.string().describe("one plain sentence on what it does"),
  nodes: z.array(nodeSchema).min(2),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        dataKey: z.string().optional(),
        label: z.string().optional(),
      }),
    )
    .default([]),
});

type GenObject = z.infer<typeof genSchema>;
type GenNode = z.infer<typeof nodeSchema>;
type GenMember = z.infer<typeof teamMemberSchema>;

/* ── Spec → canonical mapping helpers ─────────────────────────────────────── */

const AGENT_ACCENTS = ["violet", "blue", "teal", "green", "orange", "pink", "cyan"] as const;

/** Deterministic, pretty accent so multi-agent graphs stay colorful on the canvas. */
function accentForNode(kind: string, agentIdx: number, explicit?: string): string {
  if (explicit && (ACCENTS as readonly string[]).includes(explicit)) return explicit;
  switch (kind) {
    case "input":
      return "cyan";
    case "output":
      return "gold";
    case "tool":
      return "blue";
    case "evaluator":
      return "pink";
    case "transformer":
      return "slate";
    default:
      return AGENT_ACCENTS[agentIdx % AGENT_ACCENTS.length]; // agent / team
  }
}

function slugSeg(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "agent"
  );
}

function titleCase(key: string): string {
  return (
    (key || "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || key
  );
}

/** Heuristic UI component for a table key — keeps Preview rendering deterministic
 *  (out of the model) per the Architect notes. */
function pickComponent(key: string): ComponentType {
  const k = key.toLowerCase().replace(/[_-]+/g, " "); // so "dinner_plan" matches "plan"
  if (/summary|brief|report|thesis|pitch|itinerary|\bplan\b|verdict|decision|overview|answer|narrative/.test(k))
    return "summaryCard";
  if (/score|rating|grade|\bkpi\b/.test(k)) return "scoreCard";
  if (/recommend|\bpick\b|suggest/.test(k)) return "recommendationCards";
  if (
    /list|leads|comps|sources|recipes|options|candidates|results|queue|drafts|items|records|gifts|places|emails|messages|hooks|scripts|captions/.test(
      k,
    )
  )
    return "recordList";
  return "dataTable";
}

/** Flatten a team node's members (one level of nested sub-teams collapses into the
 *  crew, since a canonical team holds a flat list of agents) and wire internal edges. */
function buildTeam(node: GenNode) {
  const strategy: TeamStrategy = (TEAM_STRATEGIES as readonly string[]).includes(node.strategy as string)
    ? (node.strategy as TeamStrategy)
    : "sequential";

  const flat: GenMember[] = [];
  for (const m of node.members ?? []) {
    if (m.members && m.members.length) flat.push(...(m.members as GenMember[]));
    else flat.push(m);
  }

  const usedIds = new Set<string>();
  const agents = flat.map((m, i) => {
    let id = m.id || `${slugSeg(m.title)}-${i}`;
    while (usedIds.has(id)) id = `${id}-${i}`;
    usedIds.add(id);
    return {
      id,
      name: m.title || `Agent ${i + 1}`,
      role: m.role || "",
      prompt: m.prompt || "",
      model: "claude-sonnet-4-6",
      isLead: false,
    };
  });

  if (agents.length === 0) {
    agents.push({
      id: `${node.id}-lead`,
      name: node.title,
      role: node.role || "",
      prompt: node.prompt || "",
      model: "claude-sonnet-4-6",
      isLead: false,
    });
  }

  // lead = a member that reads like the synthesizer/judge, else the first
  const leadIdx = agents.findIndex((a) => /lead|judge|chair|synth|final|decide|aggregat|referee/i.test(`${a.role} ${a.name}`));
  const lead = agents[leadIdx >= 0 ? leadIdx : 0];
  lead.isLead = true;

  const internalEdges =
    strategy === "sequential"
      ? agents.slice(1).map((a, i) => ({ source: agents[i].id, target: a.id }))
      : agents.filter((a) => a.id !== lead.id).map((a) => ({ source: lead.id, target: a.id }));

  return { strategy, lead: lead.id, agents, internalEdges };
}

/** Map the Architect's JSON into a loose candidate Pipeline; `repairPipeline`
 *  then validates, derives tables, and lays it out. Exported for testing. */
export function architectToCandidate(obj: GenObject) {
  const rawNodes = [...(obj.nodes ?? [])];

  // Normalize kinds: keep exactly one input (first occurrence) and one output (last).
  const firstInputIdx = rawNodes.findIndex((n) => n.kind === "input");
  let lastOutputIdx = -1;
  for (let i = rawNodes.length - 1; i >= 0; i--) {
    if (rawNodes[i].kind === "output") {
      lastOutputIdx = i;
      break;
    }
  }
  rawNodes.forEach((n, i) => {
    if (n.kind === "input" && i !== firstInputIdx) n.kind = "agent";
    if (n.kind === "output" && i !== lastOutputIdx) n.kind = "agent";
  });
  if (firstInputIdx === -1 && rawNodes.length) rawNodes[0].kind = "input";
  if (lastOutputIdx === -1 && rawNodes.length) rawNodes[rawNodes.length - 1].kind = "output";

  const inputNode = rawNodes.find((n) => n.kind === "input");
  const outputNode = rawNodes.find((n) => n.kind === "output");

  let agentColorIdx = 0;
  const nodes = rawNodes.map((n) => {
    const isTeam = n.kind === "team";
    const type = isTeam ? "agent" : n.kind; // teams render as agent nodes carrying a `team`
    const layer = n.kind === "input" ? "source" : n.kind === "output" ? "surface" : "brain";
    const color = accentForNode(n.kind, isTeam || n.kind === "agent" ? agentColorIdx++ : 0, n.color);
    const outputs =
      n.outputs && n.outputs.length
        ? n.outputs
        : n.kind === "input"
          ? (n.fields ?? []).map((f) => f.name)
          : [];

    const out: Record<string, unknown> = {
      id: n.id,
      type,
      title: n.title,
      role: n.role || "",
      prompt: n.prompt || "",
      color,
      layer,
      inputs: n.inputs ?? [],
      outputs,
      model: "claude-sonnet-4-6",
    };
    if (isTeam) out.team = buildTeam(n);
    return out;
  });

  const mockInputs = (inputNode?.fields ?? []).map((f) => ({
    key: f.name,
    label: f.label || f.name,
    value: "",
  }));

  const edges = (obj.edges ?? []).map((e) => ({
    source: e.from,
    target: e.to,
    dataKey: e.dataKey,
    label: e.label,
  }));

  // UI bindings from the output node's `display` (or derived from what flows into it),
  // so the Preview surface has something meaningful the moment the pipeline renders.
  const producedKeys = new Set<string>();
  for (const n of nodes) for (const k of (n.outputs as string[]) ?? []) producedKeys.add(k);

  let display = outputNode?.display ?? [];
  if (!display.length) {
    const intoOutput = (outputNode?.inputs ?? []).filter((k) => producedKeys.has(k));
    const fallbackKeys = (intoOutput.length ? intoOutput : [...producedKeys]).slice(0, 3);
    display = fallbackKeys.map((k) => ({ label: titleCase(k), from: k }));
  }
  const uiBindings = display
    .filter((d) => producedKeys.has(d.from))
    .map((d, i) => ({
      tableId: d.from,
      componentType:
        d.component && (COMPONENT_TYPES as readonly string[]).includes(d.component)
          ? d.component
          : pickComponent(d.from),
      title: d.label || titleCase(d.from),
      position: i,
      fields: [],
    }));

  return {
    name: obj.name,
    description: obj.summary,
    nodes,
    edges,
    mockInputs,
    outputTables: [], // repairPipeline derives one per output key
    uiBindings,
  };
}

/* ── Prompt ────────────────────────────────────────────────────────────────── */

const EFFORT_GUIDE: Record<EffortLevel, string> = {
  tight:
    "EFFORT = tight. Design one clean chain. No teams, or at most one. Aim for ~3–6 nodes total. Favor a single strong agent over many small ones.",
  balanced:
    "EFFORT = balanced (default). Use a few focused nodes plus one or two small teams where coordination genuinely helps. Aim for ~6–12 nodes total.",
  deep:
    "EFFORT = deep. Use richer structure: more agents, more teams, possibly one nested team. Use parallel and debate/vote strategies where they add real quality. Cap the whole pipeline at ~30 agents total — never exceed this. Every node must justify itself.",
};

/** Catalog of data-fetch / lookup tools the Architect can wire as `tool` nodes.
 *  Write/mutating actions are excluded — the Architect designs structure, not actions. */
function toolCatalog(): string {
  const WRITE = new Set(["github_create_issue", "github_commit_files", "github_create_pull_request"]);
  return TOOLS.filter((t) => !WRITE.has(t.id))
    .map((t) => `- ${t.id} — ${t.description} [${isToolReady(t.id) ? "ready" : "needs key → falls back to seed data"}]`)
    .join("\n");
}

function systemPrompt(effort: EffortLevel): string {
  return [
    "You are Architect, the pipeline designer inside Flowmind. A person describes an AI system they want in plain language. You return a single pipeline: a set of nodes wired together, grouped into teams where it helps. You design the structure only — you do not run anything and you do not write the final answer to their problem.",
    "",
    "A pipeline is a directed graph. Data flows from one Input node, through agent/tool/transformer/evaluator nodes (and team nodes), to one Output node. Every node declares what it takes in (inputs) and puts out (outputs); a node may only read outputs produced by a node before it.",
    "",
    "Node kinds:",
    "- input — collects the starting values. Exactly one, always first. Put the starting values in `fields`.",
    "- agent — one LLM step with a focused role and a `prompt`. The workhorse.",
    "- tool — a deterministic call (search, lookup, fetch, compute). Use when real data or exact math is needed instead of the model guessing. Prefer a tool id from the catalog below and set it as the node title.",
    "- transformer — reshapes or merges data between steps (no LLM needed).",
    "- evaluator — scores, ranks, checks, or gates another node's output.",
    "- output — assembles the final result. Exactly one, always last. Put the fields the user sees in `display` (each = a label + the upstream output key to show).",
    "- team — a node that contains other agents (`members`) that coordinate via a `strategy`. From the outside a team looks like any other node (it has inputs/outputs). Use a team only when 3–4 agents form one coordinating sub-job. Don't wrap a single agent in a team. Don't nest more than 3 levels deep.",
    "",
    "Team strategies: sequential (members run in order, each building on the last), parallel (members run at once on the same input, outputs combined), router (one member inspects the input and picks which other handles it), debate (members argue opposing positions, a final member judges), vote (members answer independently, the best/majority answer wins).",
    "",
    "How to design:",
    "1. Find the real steps. One job per node — 'analyze and score and write' is three nodes, not one. Focused nodes are better.",
    "2. Use tools for facts. Current info, real records, or exact math → a tool node, not an agent guessing.",
    "3. Group into teams only when it earns it (a cluster that coordinates internally).",
    "4. Wire by data. A node may only read outputs that exist upstream. Name outputs in clear snake_case (comps, repair_costs, final_brief) and reference those exact names downstream.",
    "5. One input, one output. The output's `display` is the small set of fields the user actually sees — keep it to what matters.",
    "",
    EFFORT_GUIDE[effort],
    "Never add a node that doesn't change the result. Lean toward the smallest design that does the job well.",
    "",
    "Naming: node titles short, human, role-like ('Comp Finder', 'Repair Estimator', 'Final Judge'). Each agent's `prompt` is the instruction that node runs — write it in second person, specific about its one job, naming the inputs it uses and the output it produces. Keep everything generic to the user's domain; invent nothing about the user.",
    "",
    "Available tool nodes (wire these by id as `tool` nodes when a step needs real data or exact math):",
    toolCatalog(),
    "",
    "Rules: every edge connects ids that exist. Every node except input must be reachable from input; every node except output must reach output. Every name in a node's inputs must appear in some upstream node's outputs (or the input node's fields). ids are unique, snake_case, no spaces. If the request is too vague to design from, still return a reasonable best-guess pipeline rather than asking a question.",
  ].join("\n");
}

/* ── Entry point ─────────────────────────────────────────────────────────────
 * Generate a validated, laid-out Pipeline from a natural-language description
 * (real Claude, server-side only). Sized by the effort dial. */

export async function generateArchitectPipeline(
  description: string,
  effort: EffortLevel = "balanced",
): Promise<Pipeline> {
  const model = anthropicModel();
  const temperature = effort === "tight" ? 0.2 : effort === "deep" ? 0.6 : 0.4;

  const { object } = await generateObject({
    model,
    schema: genSchema,
    system: systemPrompt(effort),
    prompt: `Design the pipeline for: ${description}`,
    temperature,
    maxRetries: 1,
  });

  const candidate = architectToCandidate(object);
  return repairPipeline(candidate, { description, name: object.name });
}
