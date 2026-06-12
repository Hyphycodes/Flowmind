/** Handoff Packets — the compressed, structured output one node/team passes downstream.
 *  The canonical schema lives in lib/pipeline/schema.ts; re-exported here so packet
 *  code has a stable home (lib/packets/*). */
export {
  handoffPacketSchema,
  fieldChangesSchema,
  type HandoffPacket,
} from "@/lib/pipeline/schema";

/** An ordered run of packets, from team → team, for Packet View. */
export type PacketTimelineEntry = {
  packet: import("@/lib/pipeline/schema").HandoffPacket;
  fromTitle: string;
  toTitle: string;
};
