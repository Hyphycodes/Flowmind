import {
  pipelineSchema,
  type Pipeline,
  type PipelineNode,
  type RemixAction,
  type RemixChange,
  type RemixProposal,
} from "@/lib/pipeline/schema";
import { newId } from "@/lib/pipeline/validate";

/** Remix Flowmind like a creative instrument. Deterministic transforms produce a
 *  RemixProposal (changes + summary + impact) plus a proposedPipeline — the current
 *  pipeline is never mutated until the user applies it. */

const CHEAP = "claude-haiku-4-5-20251001";
const SMART = "claude-opus-4-8";

export const REMIX_ACTIONS: RemixAction[] = [
  { id: "make_premium", label: "Make it premium", category: "quality", instruction: "Bias toward premium quality + add an evaluator.", appliesTo: "pipeline" },
  { id: "make_smarter", label: "Make it smarter", category: "quality", instruction: "Upgrade brain nodes to the strongest model.", appliesTo: "pipeline" },
  { id: "make_cheaper", label: "Make it cheaper", category: "cost", instruction: "Switch models to the fast/cheap tier.", appliesTo: "pipeline" },
  { id: "make_faster", label: "Make it faster", category: "speed", instruction: "Use fast models for classifiers/scorers.", appliesTo: "pipeline" },
  { id: "add_evaluator", label: "Add an evaluator", category: "teams", instruction: "Add a judge that scores the final output.", appliesTo: "pipeline" },
  { id: "add_approval", label: "Add human approval", category: "production", instruction: "Add a human approval gate before output.", appliesTo: "pipeline" },
  { id: "add_input_studio", label: "Add Input Studio source", category: "data", instruction: "Switch the source to a reusable Input Studio dataset.", appliesTo: "pipeline" },
  { id: "add_ui", label: "Add UI", category: "ui", instruction: "Bind an unbound output table to a UI surface.", appliesTo: "pipeline" },
  { id: "make_client_ready", label: "Make client-ready", category: "business", instruction: "Add a clean summary surface + product framing.", appliesTo: "pipeline" },
  { id: "turn_into_saas", label: "Turn into SaaS", category: "business", instruction: "Frame as a SaaS: monetization + database/export direction.", appliesTo: "pipeline" },
];

export function getRemixAction(id: string): RemixAction | undefined {
  return REMIX_ACTIONS.find((a) => a.id === id);
}

function clone(p: Pipeline): Pipeline {
  return JSON.parse(JSON.stringify(p)) as Pipeline;
}

function rightmost(p: Pipeline): { x: number; y: number } {
  let x = 0;
  let y = 300;
  for (const n of p.nodes) if (n.position.x > x) { x = n.position.x; y = n.position.y; }
  return { x: x + 320, y };
}

function finalOutputKey(p: Pipeline): string {
  const outputNode = [...p.nodes].reverse().find((n) => n.type === "output") ?? p.nodes[p.nodes.length - 1];
  return outputNode?.outputs[0] ?? p.outputTables[p.outputTables.length - 1]?.id ?? "result";
}

function setModel(node: PipelineNode, model: string): void {
  node.model = model;
  node.modelSelection = { ...(node.modelSelection ?? { fallbackModelIds: [] }), mode: "manual", primaryModelId: model, fallbackModelIds: node.modelSelection?.fallbackModelIds ?? [] };
  if (node.team) for (const a of node.team.agents) a.model = model;
}

type Transform = {
  pipeline: Pipeline;
  changes: RemixChange[];
  summary: string;
  impact?: RemixProposal["estimatedImpact"];
  variationName?: string;
  warnings?: string[];
};

function applyAction(p0: Pipeline, actionId: string): Transform | null {
  const p = clone(p0);
  const changes: RemixChange[] = [];

  switch (actionId) {
    case "make_cheaper": {
      for (const n of p.nodes) if (n.type !== "input") setModel(n, CHEAP);
      changes.push({ type: "update_model", description: `Set every node to ${CHEAP.replace("claude-", "")}.` });
      return { pipeline: p, changes, summary: "Switched all models to the fast/cheap tier.", impact: { cost: "much lower", speed: "faster", quality: "slightly lower" }, variationName: "Fast / Cheap" };
    }
    case "make_smarter": {
      for (const n of p.nodes) if (n.type === "agent" || n.type === "evaluator") setModel(n, SMART);
      changes.push({ type: "update_model", description: `Upgraded brain nodes to ${SMART.replace("claude-", "")}.` });
      return { pipeline: p, changes, summary: "Upgraded reasoning nodes to the strongest model.", impact: { quality: "higher", cost: "higher" }, variationName: "Smarter" };
    }
    case "make_faster": {
      for (const n of p.nodes) if (n.type === "tool" || n.type === "evaluator" || (n.type === "agent" && /classif|scor|rank|route/i.test(`${n.title} ${n.role}`))) setModel(n, CHEAP);
      changes.push({ type: "update_model", description: `Set classifiers/scorers to ${CHEAP.replace("claude-", "")}.` });
      return { pipeline: p, changes, summary: "Sped up classifiers and scorers with fast models.", impact: { speed: "faster", cost: "lower" }, variationName: "Faster" };
    }
    case "make_premium": {
      for (const n of p.nodes) if (n.type === "agent" || n.type === "output") setModel(n, SMART);
      const drop = { ...(p.blueprint ?? {}) };
      p.blueprint = { ...drop, vibeTags: Array.from(new Set([...(drop.vibeTags ?? []), "premium", "polished"])) } as Pipeline["blueprint"];
      changes.push({ type: "update_model", description: `Upgraded agents + composer to ${SMART.replace("claude-", "")}.` });
      changes.push({ type: "update_product_drop", description: "Added premium vibe tags." });
      const withEval = ensureEvaluator(p);
      if (withEval) changes.push(withEval);
      return { pipeline: p, changes, summary: "Premium models, premium framing, and a quality judge.", impact: { quality: "higher", cost: "higher" }, variationName: "Premium" };
    }
    case "add_evaluator": {
      const change = ensureEvaluator(p);
      if (!change) return { pipeline: p0, changes: [], summary: "An evaluator already guards the output.", warnings: ["No change — evaluator already present."] };
      changes.push(change);
      return { pipeline: p, changes, summary: "Added a judge that scores the final output.", impact: { quality: "more trustworthy", complexity: "slightly higher" }, variationName: "With Evaluator" };
    }
    case "add_approval": {
      const pos = rightmost(p);
      const key = finalOutputKey(p);
      const node: PipelineNode = pipelineNode({ id: nodeId(p, "approval"), type: "output", title: "Human Approval", subtitle: "Approve & send", description: "Holds the output for a human to approve before it ships.", role: "Approval gate", color: "pink", inputs: [key], outputs: ["approved"], prompt: "Summarize what needs human approval before sending.", position: pos });
      p.nodes.push(node);
      p.edges.push({ id: newId("e"), source: lastProducerId(p0, key), target: node.id, dataKey: key, animated: false });
      changes.push({ type: "add_node", description: "Added a Human Approval gate before output.", targetId: node.id });
      return { pipeline: p, changes, summary: "Added a human approval gate before anything ships.", impact: { complexity: "slightly higher" }, variationName: "With Approval" };
    }
    case "add_input_studio": {
      const src = p.nodes.find((n) => n.type === "input" || n.type === "tool" || n.layer === "source");
      if (!src) return { pipeline: p0, changes: [], summary: "No source node to convert.", warnings: ["No source node found."] };
      src.source = { ...(src.source ?? {}), mode: "input_studio", prompt: src.source?.prompt ?? `Strong inputs for ${src.title}` };
      changes.push({ type: "update_node", description: `Set ${src.title} to use an Input Studio dataset.`, targetId: src.id });
      return { pipeline: p, changes, summary: "Switched the source to a reusable Input Studio dataset.", impact: { quality: "more testable" }, variationName: "Studio Source" };
    }
    case "add_ui": {
      const bound = new Set(p.uiBindings.map((b) => b.tableId));
      const table = p.outputTables.find((t) => !bound.has(t.id));
      if (!table) return { pipeline: p0, changes: [], summary: "Every table already has a UI surface.", warnings: ["No unbound tables."] };
      p.uiBindings.push({ id: newId("ui"), tableId: table.id, componentType: pickComponent(table), title: prettify(table.name), position: p.uiBindings.length, fields: table.columns.slice(0, 4).map((c) => c.key) });
      changes.push({ type: "add_ui_binding", description: `Bound \`${table.name}\` to a UI surface.`, targetId: table.id });
      return { pipeline: p, changes, summary: `Added a UI preview for \`${table.name}\`.`, impact: { quality: "more product-like" }, variationName: "More UI" };
    }
    case "make_client_ready": {
      const final = p.outputTables[p.outputTables.length - 1];
      if (final && !p.uiBindings.some((b) => b.tableId === final.id)) {
        p.uiBindings.unshift({ id: newId("ui"), tableId: final.id, componentType: "summaryCard", title: "Result", position: 0, fields: final.columns.slice(0, 3).map((c) => c.key) });
        changes.push({ type: "add_ui_binding", description: "Added a clean summary surface for clients.", targetId: final.id });
      }
      changes.push({ type: "update_product_drop", description: "Framed for a client audience." });
      return { pipeline: p, changes, summary: "Client-ready: a clean summary surface + product framing.", impact: { quality: "presentation-ready" }, variationName: "Client-Ready" };
    }
    case "turn_into_saas": {
      const drop = { ...(p.blueprint ?? {}) };
      p.blueprint = { ...drop, monetization: drop.monetization || "Subscription for power users; usage-based for teams.", suggestedPack: drop.suggestedPack } as Pipeline["blueprint"];
      changes.push({ type: "update_product_drop", description: "Added SaaS monetization + database/export direction." });
      changes.push({ type: "update_reality_meter", description: "Flagged database + hosted API as next build steps." });
      return { pipeline: p, changes, summary: "Framed as a SaaS — monetization + database/export direction.", impact: { quality: "business-ready" }, variationName: "SaaS" };
    }
    default:
      return null;
  }
}

function ensureEvaluator(p: Pipeline): RemixChange | null {
  if (p.nodes.some((n) => n.type === "evaluator")) return null;
  const key = finalOutputKey(p);
  const pos = rightmost(p);
  const node = pipelineNode({
    id: nodeId(p, "judge"),
    type: "evaluator",
    title: "Quality Judge",
    subtitle: "Score the output",
    description: "Scores the final output for correctness, completeness, and actionability.",
    role: "Evaluator",
    color: "gold",
    inputs: [key],
    outputs: ["quality_scores"],
    evalDimensions: ["correctness", "data_completeness", "actionability", "confidence"],
    prompt: "Score the final output across the listed dimensions and flag weak spots.",
    position: { x: pos.x, y: pos.y + 200 },
  });
  p.nodes.push(node);
  p.edges.push({ id: newId("e"), source: lastProducerId(p, key), target: node.id, dataKey: key, animated: false });
  return { type: "add_node", description: "Added a Quality Judge evaluator on the final output.", targetId: node.id };
}

function pipelineNode(partial: Partial<PipelineNode> & { id: string; type: PipelineNode["type"]; title: string; position: { x: number; y: number } }): PipelineNode {
  return {
    id: partial.id,
    type: partial.type,
    title: partial.title,
    subtitle: partial.subtitle ?? "",
    description: partial.description ?? "",
    role: partial.role ?? "",
    prompt: partial.prompt ?? "",
    model: "claude-sonnet-4-6",
    toolAttachments: [],
    position: partial.position,
    inputs: partial.inputs ?? [],
    outputs: partial.outputs ?? [],
    status: "idle",
    color: partial.color,
    evalDimensions: partial.evalDimensions,
    layer: partial.type === "output" ? "surface" : partial.type === "evaluator" ? "brain" : undefined,
  };
}

function nodeId(p: Pipeline, base: string): string {
  let id = base;
  let i = 1;
  while (p.nodes.some((n) => n.id === id)) id = `${base}-${i++}`;
  return id;
}

function lastProducerId(p: Pipeline, key: string): string {
  const producer = [...p.nodes].reverse().find((n) => n.outputs.includes(key));
  return producer?.id ?? p.nodes[p.nodes.length - 1]?.id ?? "input";
}

function prettify(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickComponent(table: { columns: { type?: string }[]; rows: unknown[] }): "metricCards" | "recordList" | "cardGrid" {
  if (table.rows.length === 1) return "metricCards";
  if (table.columns.length <= 3) return "recordList";
  return "cardGrid";
}

/** Build a deterministic remix proposal (and the proposed pipeline) for an action. */
export function buildRemixProposal(
  pipeline: Pipeline,
  actionId: string,
): { proposal: RemixProposal; pipeline: Pipeline } | null {
  const action = getRemixAction(actionId);
  const t = applyAction(pipeline, actionId);
  if (!action || !t) return null;
  const proposed = pipelineSchema.parse({ ...t.pipeline, updatedAt: new Date().toISOString() });
  const proposal: RemixProposal = {
    id: newId("remix"),
    pipelineId: pipeline.id,
    actionId,
    title: action.label,
    summary: t.summary,
    changes: t.changes,
    estimatedImpact: t.impact,
    variationName: t.variationName,
    warnings: t.warnings ?? [],
    createdAt: new Date().toISOString(),
  };
  return { proposal, pipeline: proposed };
}
