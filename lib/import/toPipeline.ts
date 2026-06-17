import type { Pipeline } from "@/lib/pipeline/schema";
import { repairPipeline } from "@/lib/pipeline/validate";
import { coordinateTeamNode, type TeamNodeLike } from "@/lib/pipeline/teamCoordinator";
import type { ImportIR, ImportedAgent } from "./ir";

/**
 * Map the detected IR (Prompt 21) onto a real Flowmind pipeline candidate, then validate + lay it
 * out via `repairPipeline`. Prompts are attached to their nodes, agents keep their detected names,
 * low-confidence detections are clearly labelled "needs review", and detected crews become team
 * nodes. Data flow is wired as an acyclic graph (inferred back-edges are dropped, not invented).
 */

type CNode = Record<string, unknown>;

const AGENT_ACCENTS = ["violet", "blue", "teal", "green", "orange", "pink", "cyan"] as const;

function outKey(a: ImportedAgent): string {
  return `${a.id}_out`;
}

function nodeTypeFor(a: ImportedAgent): string {
  return a.kind === "evaluator" ? "evaluator" : a.kind === "tool" ? "tool" : "agent";
}

function describe(a: ImportedAgent): string {
  const conf = `${Math.round(a.confidence * 100)}% confidence`;
  if (a.status === "unknown") return `⚠ Needs review (${conf}). ${a.evidence}`;
  return `Imported from ${a.framework} · ${conf}. ${a.evidence}`;
}

/** Build the pipeline candidate. Returns null when there's nothing to render. */
export function irToPipeline(ir: ImportIR, name = "Imported System"): Pipeline | null {
  if (ir.agents.length === 0) return null;

  // Which agents are inside a team (team members are rendered as a single team node, not flat).
  const teamOf = new Map<string, string>(); // agentId → teamId
  for (const t of ir.teams) for (const id of t.memberIds) if (!teamOf.has(id)) teamOf.set(id, t.id);

  const flatAgents = ir.agents.filter((a) => !teamOf.has(a.id));

  let colorIdx = 0;
  const nextColor = () => AGENT_ACCENTS[colorIdx++ % AGENT_ACCENTS.length];

  const nodes: CNode[] = [];

  // Input node — collects a generic entry payload.
  nodes.push({
    id: "input",
    type: "input",
    title: "Input",
    role: "",
    prompt: "",
    color: "cyan",
    layer: "source",
    inputs: [],
    outputs: ["input"],
    model: "claude-sonnet-4-6",
  });

  // Flat agent nodes.
  for (const a of flatAgents) {
    nodes.push({
      id: a.id,
      type: nodeTypeFor(a),
      title: a.status === "unknown" ? `${a.name} (review)` : a.name,
      role: a.role ?? "",
      description: describe(a),
      prompt: a.prompt ?? "",
      color: nextColor(),
      layer: "brain",
      inputs: [],
      outputs: [outKey(a)],
      model: a.model && /claude/i.test(a.model) ? a.model : "claude-sonnet-4-6",
    });
  }

  // Team nodes — one per detected team, carrying its members.
  for (const t of ir.teams) {
    const members = ir.agents.filter((a) => t.memberIds.includes(a.id));
    if (members.length === 0) continue;
    const teamNode: CNode = {
      id: t.id,
      type: "agent",
      title: t.name,
      role: "",
      description: `Imported crew (${Math.round(t.confidence * 100)}% confidence). ${t.evidence}`,
      prompt: "",
      color: nextColor(),
      layer: "brain",
      inputs: [],
      outputs: [`${t.id}_out`],
      model: "claude-sonnet-4-6",
      team: {
        strategy: t.strategy === "single" ? "single" : t.strategy,
        agents: members.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role ?? "",
          prompt: m.prompt ?? "",
          model: m.model && /claude/i.test(m.model) ? m.model : "claude-sonnet-4-6",
          isLead: false,
        })),
      },
    };
    nodes.push(teamNode);
  }

  // Resolve a flow endpoint to the rendered node id (a member maps to its team node).
  const renderId = (agentId: string) => teamOf.get(agentId) ?? agentId;

  // Build acyclic edges from flows (collapse member→team, drop self/back edges).
  const order = new Map<string, number>();
  nodes.forEach((n, i) => order.set(n.id as string, i));
  const edgeSet = new Set<string>();
  const edges: CNode[] = [];
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();

  for (const f of ir.flows) {
    const s = renderId(f.from);
    const t = renderId(f.to);
    if (s === t) continue;
    if (!order.has(s) || !order.has(t)) continue;
    // keep forward edges only (avoid cycles): source must come before target in node order
    const [a, b] = (order.get(s)! <= order.get(t)!) ? [s, t] : [t, s];
    const key = `${a}->${b}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    const srcOut = (nodes.find((n) => n.id === a)!.outputs as string[])[0];
    edges.push({ source: a, target: b, dataKey: srcOut, label: srcOut });
    hasOutgoing.add(a);
    hasIncoming.add(b);
  }

  // Wire input → every brain node with no detected incoming flow.
  const brainNodes = nodes.filter((n) => n.id !== "input");
  for (const n of brainNodes) {
    if (!hasIncoming.has(n.id as string)) {
      edges.push({ source: "input", target: n.id, dataKey: "input", label: "input" });
      hasIncoming.add(n.id as string);
    }
  }

  // Output node — collects every leaf (no outgoing flow).
  const leaves = brainNodes.filter((n) => !hasOutgoing.has(n.id as string));
  const outputId = "output";
  nodes.push({
    id: outputId,
    type: "output",
    title: "Result",
    role: "",
    prompt: "",
    color: "gold",
    layer: "surface",
    inputs: leaves.map((n) => (n.outputs as string[])[0]),
    outputs: ["result"],
    model: "claude-sonnet-4-6",
  });
  for (const n of leaves) {
    edges.push({ source: n.id, target: outputId, dataKey: (n.outputs as string[])[0], label: (n.outputs as string[])[0] });
  }

  // Coordinate any team nodes (controllers, internal wiring).
  const coordinated = nodes.map((n) => (n.team ? (coordinateTeamNode(n as unknown as TeamNodeLike) as unknown as CNode) : n));

  const candidate = {
    name,
    description: `Imported from existing code — ${ir.agents.length} detected node(s) across ${ir.frameworks.filter((f) => f !== "unknown").join(", ") || "raw SDK calls"}. Review before running.`,
    nodes: coordinated,
    edges,
    mockInputs: [{ key: "input", label: "Input", value: "" }],
    outputTables: [],
    uiBindings: [],
  };

  try {
    return repairPipeline(candidate, { description: candidate.description, name });
  } catch {
    return null;
  }
}
