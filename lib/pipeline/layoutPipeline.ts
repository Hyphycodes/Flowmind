import type { Pipeline } from "./schema";

const COL_GAP = 300;
const ROW_GAP = 168;
const X0 = 60;
const Y0 = 300;

/** Assign left→right positions by longest-path layering over the DAG.
 *  Used for AI-generated pipelines; hand-authored fixtures keep their own positions. */
export function layoutPipeline(p: Pipeline): Pipeline {
  if (p.nodes.length === 0) return p;

  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of p.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of p.edges) {
    if (!adj.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const layer = new Map<string, number>();
  const indegCopy = new Map(indeg);
  const q: string[] = [];
  for (const n of p.nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) {
      q.push(n.id);
      layer.set(n.id, 0);
    }
  }
  while (q.length) {
    const u = q.shift()!;
    const lu = layer.get(u) ?? 0;
    for (const v of adj.get(u) ?? []) {
      layer.set(v, Math.max(layer.get(v) ?? 0, lu + 1));
      indegCopy.set(v, (indegCopy.get(v) ?? 0) - 1);
      if ((indegCopy.get(v) ?? 0) === 0) q.push(v);
    }
  }
  for (const n of p.nodes) if (!layer.has(n.id)) layer.set(n.id, 0);

  const byLayer = new Map<number, string[]>();
  for (const n of p.nodes) {
    const l = layer.get(n.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  }

  const pos = new Map<string, { x: number; y: number }>();
  for (const [l, ids] of byLayer) {
    const count = ids.length;
    ids.forEach((id, i) => {
      pos.set(id, { x: X0 + l * COL_GAP, y: Y0 + (i - (count - 1) / 2) * ROW_GAP });
    });
  }

  return { ...p, nodes: p.nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })) };
}
