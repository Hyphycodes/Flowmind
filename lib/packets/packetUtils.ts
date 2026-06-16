import type { HandoffPacket, Pipeline } from "@/lib/pipeline/schema";
import type { PacketTimelineEntry } from "./schema";

export function newPacketId(seed = "pkt"): string {
  return `${seed}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildPacket(input: Partial<HandoffPacket> & { fromNodeId: string }): HandoffPacket {
  return {
    packetId: input.packetId ?? newPacketId(),
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    summary: input.summary ?? "",
    keyFields: input.keyFields ?? {},
    confidence: input.confidence ?? 0,
    assumptions: input.assumptions ?? [],
    missingData: input.missingData ?? [],
    warnings: input.warnings ?? [],
    sourceReferences: input.sourceReferences ?? [],
    fieldChanges: input.fieldChanges ?? { added: [], compressed: [], dropped: [] },
    nextAction: input.nextAction,
  };
}

/** Compare the fields available upstream vs. what a packet carried forward. */
export function computeFieldChanges(
  prevFieldKeys: string[],
  packet: HandoffPacket,
): { added: string[]; compressed: string[]; dropped: string[] } {
  const packetKeys = new Set(Object.keys(packet.keyFields));
  const prev = new Set(prevFieldKeys);
  const added = [...packetKeys].filter((k) => !prev.has(k));
  const dropped = [...prev].filter((k) => !packetKeys.has(k));
  return { added, compressed: packet.fieldChanges.compressed, dropped };
}

/** Packet-loss warnings: fields present upstream that silently vanished
 *  (not carried, not explicitly compressed or dropped). Essential for debugging
 *  complex multi-team systems. */
export function detectPacketLoss(upstreamFieldKeys: string[], packet: HandoffPacket): string[] {
  const carried = new Set(Object.keys(packet.keyFields));
  const declared = new Set([...packet.fieldChanges.compressed, ...packet.fieldChanges.dropped]);
  return upstreamFieldKeys.filter((k) => !carried.has(k) && !declared.has(k));
}

/** Order packets along the pipeline's node order for Packet View. */
export function packetTimeline(pipeline: Pipeline, packets: HandoffPacket[]): PacketTimelineEntry[] {
  const titleOf = (id?: string) => pipeline.nodes.find((n) => n.id === id)?.title ?? id ?? "—";
  const order = new Map(pipeline.nodes.map((n, i) => [n.id, i]));
  return [...packets]
    .sort((a, b) => (order.get(a.fromNodeId) ?? 0) - (order.get(b.fromNodeId) ?? 0))
    .map((packet) => ({
      packet,
      fromTitle: titleOf(packet.fromNodeId),
      toTitle: titleOf(packet.toNodeId),
    }));
}
