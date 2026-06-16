import { z } from "zod";
import {
  ACCENTS,
  NODE_TYPES,
  pipelineNodeSchema,
  pipelineSchema,
  type Pipeline,
  type PipelineNode,
} from "./schema";
import { newId } from "./validate";
import { coordinateTeamNode } from "./teamCoordinator";

/** The Editor diff vocabulary (Task 03). The Editor model returns a set of reviewable `changes`,
 *  each a self-contained edit a person approves with a checkbox before anything is applied. Apply is
 *  mechanical + invertible so the whole proposal reverts in one undo step. */

const editNodeSchema = z
  .object({
    id: z.string(),
    type: z.enum(NODE_TYPES).optional(),
    title: z.string().optional(),
    role: z.string().optional(),
    prompt: z.string().optional(),
    model: z.string().optional(),
    model_hint: z.string().optional(),
    color: z.enum(ACCENTS).optional(),
    inputs: z.array(z.string()).optional(),
    outputs: z.array(z.string()).optional(),
    team: z.any().optional(),
  })
  .passthrough();

const edgeRefSchema = z.object({
  source: z.string(),
  target: z.string(),
  dataKey: z.string().optional(),
});

export const editDiffSchema = z.object({
  add_nodes: z.array(editNodeSchema).default([]),
  remove_nodes: z.array(z.string()).default([]),
  add_edges: z.array(edgeRefSchema).default([]),
  remove_edges: z.array(edgeRefSchema).default([]),
  modify_nodes: z.array(z.object({ id: z.string() }).passthrough()).default([]),
});
export type EditDiff = z.infer<typeof editDiffSchema>;

export const editChangeSchema = z.object({
  id: z.string(),
  summary: z.string(),
  why: z.string().default(""),
  depends_on: z.array(z.string()).default([]),
  diff: editDiffSchema,
});
export type EditChange = z.infer<typeof editChangeSchema>;

export const editProposalSchema = z.object({ changes: z.array(editChangeSchema).default([]) });
export type EditProposal = z.infer<typeof editProposalSchema>;

/* ── Ghost preview helpers (the canvas shows the shape before committing) ──────────── */

/** Nodes/edges a set of changes would add or remove — for the dashed ghost preview. */
export function previewOf(changes: EditChange[]): {
  addNodeIds: Set<string>;
  removeNodeIds: Set<string>;
  addEdges: { source: string; target: string }[];
  removeEdges: { source: string; target: string }[];
  ghostNodes: PipelineNode[];
} {
  const addNodeIds = new Set<string>();
  const removeNodeIds = new Set<string>();
  const addEdges: { source: string; target: string }[] = [];
  const removeEdges: { source: string; target: string }[] = [];
  const ghostNodes: PipelineNode[] = [];
  for (const ch of changes) {
    for (const n of ch.diff.add_nodes) {
      addNodeIds.add(n.id);
      ghostNodes.push(coerceNode(n));
    }
    for (const id of ch.diff.remove_nodes) removeNodeIds.add(id);
    for (const e of ch.diff.add_edges) addEdges.push({ source: e.source, target: e.target });
    for (const e of ch.diff.remove_edges) removeEdges.push({ source: e.source, target: e.target });
  }
  return { addNodeIds, removeNodeIds, addEdges, removeEdges, ghostNodes };
}

/* ── Mechanical apply ─────────────────────────────────────────────────────────────── */

function coerceNode(raw: z.infer<typeof editNodeSchema>): PipelineNode {
  const model = raw.model || raw.model_hint || "claude-sonnet-4-6";
  return pipelineNodeSchema.parse({
    id: raw.id,
    type: raw.type ?? "agent",
    title: raw.title ?? raw.id,
    role: raw.role ?? "",
    prompt: raw.prompt ?? "",
    model,
    color: raw.color,
    inputs: raw.inputs ?? [],
    outputs: raw.outputs ?? [],
    position: { x: 0, y: 0 },
    team: raw.team,
    status: "idle",
  });
}

/** Place a freshly-added node near its wiring without disturbing existing node positions. */
function placeNewNode(p: Pipeline, nodeId: string, newIds: Set<string>): { x: number; y: number } {
  const incoming = p.edges.find((e) => e.target === nodeId && !newIds.has(e.source));
  const src = incoming && p.nodes.find((n) => n.id === incoming.source);
  if (src) return { x: src.position.x + 300, y: src.position.y + 40 };
  const outgoing = p.edges.find((e) => e.source === nodeId && !newIds.has(e.target));
  const tgt = outgoing && p.nodes.find((n) => n.id === outgoing.target);
  if (tgt) return { x: Math.max(0, tgt.position.x - 300), y: tgt.position.y + 40 };
  const maxX = Math.max(0, ...p.nodes.map((n) => n.position.x));
  return { x: maxX + 320, y: 0 };
}

function applyOneChange(p: Pipeline, change: EditChange, newIds: Set<string>): Pipeline {
  let nodes = [...p.nodes];
  let edges = [...p.edges];
  const d = change.diff;

  // 1. add_nodes (skip ids that already exist)
  for (const raw of d.add_nodes) {
    if (nodes.some((n) => n.id === raw.id)) continue;
    nodes.push(coerceNode(raw));
    newIds.add(raw.id);
  }
  // 2. remove_nodes (+ drop edges touching them; the model supplies bypass edges)
  if (d.remove_nodes.length) {
    const gone = new Set(d.remove_nodes);
    nodes = nodes.filter((n) => !gone.has(n.id));
    edges = edges.filter((e) => !gone.has(e.source) && !gone.has(e.target));
  }
  // 3. add_edges (only between nodes that now exist; dedupe)
  const exists = new Set(nodes.map((n) => n.id));
  for (const e of d.add_edges) {
    if (!exists.has(e.source) || !exists.has(e.target) || e.source === e.target) continue;
    if (edges.some((x) => x.source === e.source && x.target === e.target)) continue;
    edges.push({ id: newId("e"), source: e.source, target: e.target, dataKey: e.dataKey, animated: false });
  }
  // 4. remove_edges
  for (const e of d.remove_edges) {
    edges = edges.filter((x) => !(x.source === e.source && x.target === e.target));
  }
  // 5. modify_nodes (patch declared fields; never silently rewrite team members)
  for (const m of d.modify_nodes) {
    nodes = nodes.map((n) => {
      if (n.id !== m.id) return n;
      const { id: _id, model_hint, ...rest } = m as Record<string, unknown> & { id: string; model_hint?: string };
      void _id;
      const patch: Record<string, unknown> = { ...rest };
      if (model_hint && !patch.model) patch.model = model_hint;
      return { ...n, ...patch } as PipelineNode;
    });
  }

  return { ...p, nodes, edges };
}

/**
 * Apply checked changes in order. Re-validates after each change against the canonical schema;
 * a change that would break the graph is skipped (not applied), and reported. Teams touched by a
 * change are re-coordinated (controllers/wiring rebuild). New nodes are placed near their wiring.
 */
export function applyChangesToPipeline(
  base: Pipeline,
  changes: EditChange[],
): { pipeline: Pipeline; applied: string[]; skipped: { id: string; reason: string }[] } {
  let p = base;
  const applied: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const newIds = new Set<string>();

  for (const change of changes) {
    const candidate = applyOneChange(p, change, newIds);
    const parsed = pipelineSchema.safeParse(candidate);
    if (!parsed.success) {
      skipped.push({ id: change.id, reason: "would break the graph" });
      continue;
    }
    // every node except input must keep at least a path in/out is a soft check; the schema parse
    // plus edge sanity above is the hard gate.
    p = parsed.data;
    applied.push(change.id);
  }

  // Place new nodes (keep existing positions stable).
  if (newIds.size) {
    p = {
      ...p,
      nodes: p.nodes.map((n) =>
        newIds.has(n.id) && n.position.x === 0 && n.position.y === 0
          ? { ...n, position: placeNewNode(p, n.id, newIds) }
          : n,
      ),
    };
  }

  // Re-coordinate any team nodes so controllers + internal wiring rebuild.
  p = { ...p, nodes: p.nodes.map((n) => (n.team ? coordinateTeamNode(n) : n)), updatedAt: new Date().toISOString() };

  return { pipeline: p, applied, skipped };
}

/** Server-side screen: keep only changes that, applied alone to the base, yield a valid graph. */
export function screenChanges(base: Pipeline, changes: EditChange[]): EditChange[] {
  return changes.filter((ch) => {
    try {
      const candidate = applyOneChange(base, ch, new Set<string>());
      return pipelineSchema.safeParse(candidate).success;
    } catch {
      return false;
    }
  });
}
