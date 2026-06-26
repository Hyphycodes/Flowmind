import type { Pipeline, PipelineNode } from "./schema";

export type LineageRef = { id: string; title: string };

/** For each declared input key of a node, which upstream node(s) produce it. Resolution:
 *  prefer an upstream feeder whose declared outputs include the key; otherwise, if the node has
 *  exactly one feeder, attribute the key to it; otherwise leave it unresolved (empty). This is
 *  the node-level "what fed me, from where" answer (Prompt 06). */
export function inputSources(p: Pipeline, node: PipelineNode): Record<string, LineageRef[]> {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const feeders = p.edges
    .filter((e) => e.target === node.id)
    .map((e) => byId.get(e.source))
    .filter((n): n is PipelineNode => Boolean(n));

  const out: Record<string, LineageRef[]> = {};
  for (const key of node.inputs) {
    const matches = feeders.filter((f) => f.outputs.includes(key));
    const refs = matches.length ? matches : feeders.length === 1 ? [feeders[0]] : [];
    out[key] = refs.map((n) => ({ id: n.id, title: n.title }));
  }
  return out;
}

/** For each declared output key of a node, which downstream node(s) consume it — the
 *  "what did I make, and who uses it" answer. Symmetric to inputSources. */
export function outputConsumers(p: Pipeline, node: PipelineNode): Record<string, LineageRef[]> {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const consumers = p.edges
    .filter((e) => e.source === node.id)
    .map((e) => byId.get(e.target))
    .filter((n): n is PipelineNode => Boolean(n));

  const out: Record<string, LineageRef[]> = {};
  for (const key of node.outputs) {
    const matches = consumers.filter((c) => c.inputs.includes(key));
    const refs = matches.length ? matches : consumers.length === 1 ? [consumers[0]] : [];
    out[key] = refs.map((n) => ({ id: n.id, title: n.title }));
  }
  return out;
}
