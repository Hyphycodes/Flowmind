import type { HandoffPacket, PacketWarning, Pipeline } from "@/lib/pipeline/schema";
import { newId } from "@/lib/pipeline/validate";
import { detectPacketLoss } from "./packetUtils";

export function analyzePacketFieldDrift(
  pipeline: Pipeline,
  packet: HandoffPacket,
  upstreamFieldKeys: string[],
): PacketWarning[] {
  const warnings: PacketWarning[] = [];
  const carried = new Set(Object.keys(packet.keyFields));
  const compressed = new Set(packet.fieldChanges.compressed);
  const dropped = new Set(packet.fieldChanges.dropped);
  const addWarning = (message: string, field?: string, severity: PacketWarning["severity"] = "warning") => {
    warnings.push({
      id: newId("pw"),
      packetId: packet.packetId,
      fromNodeId: packet.fromNodeId,
      toNodeId: packet.toNodeId,
      severity,
      message,
      field,
    });
  };

  for (const field of detectPacketLoss(upstreamFieldKeys, packet)) {
    addWarning(`${field} was present upstream but was not carried, compressed, or dropped in this packet.`, field);
  }

  for (const edge of pipeline.edges.filter((e) => e.source === packet.fromNodeId)) {
    const targetMatches = !packet.toNodeId || edge.target === packet.toNodeId;
    if (!targetMatches) continue;
    for (const field of edge.contract?.expects ?? []) {
      if (!field.required) continue;
      if (!carried.has(field.key) && !compressed.has(field.key)) {
        addWarning(`${field.key} is required downstream but is missing from the handoff packet.`, field.key, "error");
      }
    }
  }

  if (packet.confidence >= 0.8 && dropped.size > 0) {
    addWarning(
      `High-confidence packet dropped ${dropped.size} field${dropped.size === 1 ? "" : "s"}; confirm the downstream team does not need them.`,
      [...dropped][0],
    );
  }

  if (packet.warnings.length > 0 && !carried.has("warnings") && !compressed.has("warnings")) {
    addWarning("Packet includes warnings; make sure the next team sees the caution before acting.", "warnings", "info");
  }

  return warnings;
}
