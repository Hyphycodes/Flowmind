import type { HandoffPacket, OutputTable, PipelineNode } from "@/lib/pipeline/schema";
import { buildPacket } from "@/lib/packets/packetUtils";

/** Produce a node's output tables (simulate): use seeded tables for the node's output
 *  keys, else a small fallback table. Live execution would call a model adapter here. */
export function executeSingleAgent(
  node: PipelineNode,
  _upstream: OutputTable[],
  seed: Map<string, OutputTable>,
): OutputTable[] {
  const keys = node.outputs.length ? node.outputs : [node.id];
  return keys.map((key) => {
    const seeded = seed.get(key);
    if (seeded) return { ...seeded, sourceNodeId: node.id };
    return {
      id: key,
      name: key,
      sourceNodeId: node.id,
      description: "",
      columns: [{ key: "summary", label: "Summary", type: "text" as const }],
      rows: [{ summary: `${node.title} output (simulate)` }],
    };
  });
}

export function createHandoffPacket(node: PipelineNode, toNodeId: string | undefined, tables: OutputTable[]): HandoffPacket {
  return buildPacket({
    packetId: `pkt_${node.id}`,
    fromNodeId: node.id,
    toNodeId,
    summary: `${node.title} handed off ${tables.map((t) => t.name).join(", ") || "no tables"}.`,
    keyFields: { tables: tables.map((t) => t.name), rowCounts: tables.map((t) => t.rows.length) },
    confidence: 0.8,
    sourceReferences: tables.map((t) => t.name),
    fieldChanges: { added: node.outputs, compressed: [], dropped: [] },
  });
}

export function executeTeamNode(
  node: PipelineNode,
  upstream: OutputTable[],
  seed: Map<string, OutputTable>,
  toNodeId?: string,
): { tables: OutputTable[]; packet: HandoffPacket } {
  const tables = executeSingleAgent(node, upstream, seed);
  return { tables, packet: createHandoffPacket(node, toNodeId, tables) };
}
