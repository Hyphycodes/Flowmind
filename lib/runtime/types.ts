import type { HandoffPacket, OutputTable, Pipeline } from "@/lib/pipeline/schema";
import type { Dataset } from "@/lib/datasets/schema";

/** Portable runtime types (future @flowmind/sdk surface). The runtime is the small
 *  engine that lets a real app run a Flowmind pipeline. */
export type RuntimeMode = "simulate" | "live" | "hybrid";
export type RuntimeInput = Record<string, unknown>;

export type RuntimeRunOptions = {
  pipeline: Pipeline;
  input?: RuntimeInput;
  mode?: RuntimeMode;
  datasets?: Dataset[];
};

export type RuntimeFinalOutput = {
  title: string;
  summary: string;
  highlights: { label: string; value: string }[];
};

export type RuntimeRunResult = {
  finalOutput: RuntimeFinalOutput;
  outputTables: OutputTable[];
  handoffPackets: HandoffPacket[];
  order: string[];
  warnings: string[];
};

export type { OutputTable, HandoffPacket, Pipeline, Dataset };
