/* eslint-disable @typescript-eslint/no-explicit-any -- this module coerces loosely-typed raw
 * model output into a valid Pipeline; `any` is intentional at the untyped boundary. */
import {
  pipelineSchema,
  COMPONENT_TYPES,
  NODE_TYPES,
  type NodeType,
  type Pipeline,
} from "./schema";
import { layoutPipeline } from "./layoutPipeline";

export function safeParsePipeline(data: unknown) {
  return pipelineSchema.safeParse(data);
}

export function newId(prefix = "pl"): string {
  const g = globalThis.crypto;
  if (g?.randomUUID) return g.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slug(s: string, i: number): string {
  const base = (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `node-${i + 1}`;
}

/** Coerce a loosely-shaped object (e.g. raw model output) into a valid, laid-out
 *  Pipeline. Fills ids/types/positions, repairs edges, derives tables. Throws only
 *  if the result still can't satisfy the schema. */
export function repairPipeline(
  raw: unknown,
  opts?: { id?: string; description?: string; name?: string },
): Pipeline {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawNodes: any[] = Array.isArray(obj.nodes) ? obj.nodes : [];

  const usedIds = new Set<string>();
  const nodes = rawNodes.map((n, i) => {
    let nid =
      typeof n?.id === "string" && n.id ? String(n.id) : slug(n?.title ?? "", i);
    while (usedIds.has(nid)) nid = `${nid}-${i}`;
    usedIds.add(nid);
    const type: NodeType = (NODE_TYPES as readonly string[]).includes(n?.type)
      ? n.type
      : i === 0
        ? "input"
        : i === rawNodes.length - 1
          ? "output"
          : "agent";
    return {
      id: nid,
      type,
      title: typeof n?.title === "string" && n.title ? n.title : `Node ${i + 1}`,
      subtitle: n?.subtitle ?? "",
      description: n?.description ?? "",
      role: n?.role ?? "",
      prompt: n?.prompt ?? "",
      model: n?.model ?? "claude-sonnet-4-6",
      color: n?.color,
      position: n?.position ?? { x: 0, y: 0 },
      inputs: Array.isArray(n?.inputs) ? n.inputs.map(String) : [],
      outputs: Array.isArray(n?.outputs) ? n.outputs.map(String) : [],
      status: "idle" as const,
      // optional, additive fields preserved so generated grouping/config survives
      layer: n?.layer,
      source: n?.source,
      evalDimensions: Array.isArray(n?.evalDimensions) ? n.evalDimensions.map(String) : undefined,
      team: n?.team,
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  let edges: any[] = Array.isArray(obj.edges)
    ? obj.edges.filter((e: any) => nodeIds.has(e?.source) && nodeIds.has(e?.target))
    : [];
  if (edges.length === 0 && nodes.length > 1) {
    edges = nodes.slice(1).map((n, i) => ({
      id: `e-${nodes[i].id}-${n.id}`,
      source: nodes[i].id,
      target: n.id,
      animated: false,
      dataKey: nodes[i].outputs?.[0],
    }));
  } else {
    edges = edges.map((e: any, i: number) => ({
      id: e.id ?? `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      label: e.label,
      dataKey: e.dataKey,
      animated: !!e.animated,
    }));
  }

  const COL_TYPES = ["text", "number", "currency", "percent", "badge", "date"];
  const sanitizeTable = (t: any) => ({
    id: typeof t?.id === "string" && t.id ? t.id : String(t?.name ?? "table"),
    name: typeof t?.name === "string" && t.name ? t.name : String(t?.id ?? "table"),
    sourceNodeId: typeof t?.sourceNodeId === "string" ? t.sourceNodeId : undefined,
    description: typeof t?.description === "string" ? t.description : "",
    columns: Array.isArray(t?.columns)
      ? t.columns.map((c: any) => ({
          key: String(c?.key ?? "col"),
          label: String(c?.label ?? c?.key ?? "Col"),
          type: COL_TYPES.includes(c?.type) ? c.type : "text",
        }))
      : [],
    rows: Array.isArray(t?.rows) ? t.rows : [],
  });

  const outputTables: any[] =
    Array.isArray(obj.outputTables) && obj.outputTables.length
      ? obj.outputTables.map(sanitizeTable)
      : [];
  if (outputTables.length === 0) {
    const seen = new Set<string>();
    for (const n of nodes)
      for (const key of n.outputs ?? []) {
        if (seen.has(key)) continue;
        seen.add(key);
        outputTables.push({
          id: key,
          name: key,
          sourceNodeId: n.id,
          description: "",
          columns: [],
          rows: [],
        });
      }
  }

  const uiBindings: any[] = (Array.isArray(obj.uiBindings) ? obj.uiBindings : [])
    .filter((b: any) => (COMPONENT_TYPES as readonly string[]).includes(b?.componentType))
    .map((b: any, i: number) => ({
      id: typeof b?.id === "string" && b.id ? b.id : `b-${i}-${b?.tableId ?? "t"}`,
      tableId: String(b?.tableId ?? ""),
      componentType: b.componentType,
      title: typeof b?.title === "string" ? b.title : "",
      position: typeof b?.position === "number" ? b.position : i,
      fields: Array.isArray(b?.fields) ? b.fields.map(String) : [],
    }));

  const candidate = {
    id: opts?.id ?? (typeof obj.id === "string" ? obj.id : newId()),
    name: opts?.name ?? (typeof obj.name === "string" ? obj.name : "Untitled Pipeline"),
    description: opts?.description ?? (typeof obj.description === "string" ? obj.description : ""),
    nodes,
    edges,
    mockInputs: Array.isArray(obj.mockInputs) ? obj.mockInputs : [],
    outputTables,
    uiBindings,
    runHistory: [],
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const parsed = pipelineSchema.parse(candidate);
  return layoutPipeline(parsed);
}
