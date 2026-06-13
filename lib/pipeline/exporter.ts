import type {
  AgentRunTrace,
  FinalOutput,
  HandoffPacket,
  OutputTable,
  PacketWarning,
  Pipeline,
  RunTrace,
  Take,
  TeamRunTrace,
} from "./schema";
import type { Dataset } from "@/lib/datasets/schema";
import type { EvalResult } from "@/lib/evals/schema";
import { EXPORT_MODES } from "@/lib/export/schema";
import { downloadExportBundle, type ExportContext } from "@/lib/export/bundle";

/** Back-compat shape used by the older one-click export callers. */
export type ExportRun = {
  steps?: unknown;
  tables?: OutputTable[];
  finalOutput?: FinalOutput | null;
  packets?: HandoffPacket[];
  packetWarnings?: PacketWarning[];
  agentRuns?: AgentRunTrace[];
  teamRuns?: TeamRunTrace[];
  toolTraces?: unknown[];
  runTrace?: RunTrace | null;
  datasets?: Dataset[];
  takes?: Take[];
  evalResults?: EvalResult[];
};

/** One-click "export everything" — builds + downloads the full ZIP (all modes).
 *  The richer mode-aware flow lives in lib/export/bundle (createExportBundle). */
export async function exportPipeline(pipeline: Pipeline, run?: ExportRun | null): Promise<void> {
  const ctx: ExportContext = { pipeline, run: run ?? null };
  await downloadExportBundle(ctx, [...EXPORT_MODES]);
}
