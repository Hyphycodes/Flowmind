import type { Pipeline } from "@/lib/pipeline/schema";
import { analyzeFiles, type SourceFile } from "./detect";
import { irToPipeline } from "./toPipeline";
import type { ImportIR, ImportReport } from "./ir";

export type { SourceFile } from "./detect";
export type { ImportIR, ImportReport, ImportedAgent } from "./ir";

/**
 * Import a folder/repo's source files into a Flowmind pipeline (Prompt 21). Pure + server-side.
 * Static analysis only — no code is sent to any AI model (an AI-assisted pass would be a separate,
 * disclosed opt-in). Returns the IR (for the review step), an honest report, and a candidate
 * pipeline (null when no AI system was found).
 */
export function importCodebase(files: SourceFile[], name?: string): {
  ir: ImportIR;
  report: ImportReport;
  pipeline: Pipeline | null;
} {
  const { ir, report } = analyzeFiles(files);
  const pipeline = irToPipeline(ir, name || "Imported System");
  return { ir, report, pipeline };
}
