import JSZip from "jszip";
import { saveAs } from "file-saver";
import type {
  AgentRunTrace,
  FinalOutput,
  HandoffPacket,
  OutputTable,
  PacketWarning,
  Pipeline,
  ProductBrief,
  ProductDrop,
  RealityMeter,
  RunTrace,
  Take,
  TeamRunTrace,
} from "@/lib/pipeline/schema";
import type { Dataset } from "@/lib/datasets/schema";
import type { EvalResult } from "@/lib/evals/schema";
import { newId } from "@/lib/pipeline/validate";
import { generateProductDrop } from "@/lib/product/productDrop";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { generateProductBrief } from "@/lib/product/brief";
import { type DocsContext } from "./docs";
import { buildDevBundle } from "./devBundle";
import { founderBriefHtml, clientBlueprintHtml } from "./visualDocs";
import { buildExportHealthCheck } from "./healthCheck";
import { assertNoSecretsInExport } from "@/lib/security/secrets";
import {
  type ExportFileType,
  type ExportManifest,
  type ExportManifestFile,
  type ExportMode,
} from "./schema";

export type ExportContext = {
  pipeline: Pipeline;
  run?: {
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
  } | null;
  productDrop?: ProductDrop;
  realityMeter?: RealityMeter;
  productBrief?: ProductBrief;
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pipeline";
}

/** A single generated export file (path + raw text). Reused by the ZIP path and the
 *  GitHub repo-export path so export logic is never duplicated. */
export type ExportFile = { path: string; content: string; type: ExportFileType; description?: string };

/** Collect every export file (pure, no ZIP / no `file-saver`) for the selected modes.
 *  Both `createExportBundle` (download) and the GitHub repo export reuse this. */
export function collectExportFiles(
  ctx: ExportContext,
  modes: ExportMode[],
): { files: ExportFile[]; manifest: ExportManifest; slug: string } {
  const p = ctx.pipeline;
  const run = ctx.run ?? null;
  const drop = ctx.productDrop ?? generateProductDrop(p);
  const reality = ctx.realityMeter ?? calculateRealityMeter(p, { latestTakeSuccess: run?.runTrace?.status === "success" });
  const brief = ctx.productBrief ?? generateProductBrief(p, drop, reality);
  const docsCtx: DocsContext = { pipeline: p, drop, reality, brief, finalOutput: run?.finalOutput ?? null };

  const has = (m: ExportMode) => modes.includes(m);
  const developer = has("developer");
  const tables = run?.tables ?? p.outputTables;
  const datasets = run?.datasets ?? [];
  const slug = slugify(drop.name);

  const out: ExportFile[] = [];
  const files: ExportManifestFile[] = [];
  const inferType = (path: string): ExportFileType =>
    path.endsWith(".json") ? "json" : path.endsWith(".md") ? "markdown" : path.endsWith(".ts") || path.endsWith(".tsx") ? "typescript" : "text";
  const put = (path: string, content: string, description?: string) => {
    out.push({ path, content, type: inferType(path), description });
    files.push({ path, type: inferType(path), description });
  };

  // Three audience-matched tiers (Prompt 22). The old export dumped ~40 internal-representation
  // files; these are clean and useful: a runnable dev bundle, a founder PDF, a client blueprint.

  // ── Developer bundle — a self-contained, single-import, runnable package at the root ──
  if (developer) {
    for (const f of buildDevBundle(p, tables, slug)) put(f.path, f.content, f.description);
  } else {
    // No dev bundle selected → a short root README so the ZIP isn't bare.
    put(
      "README.md",
      `# ${drop.name}\n\n${drop.pitch || p.description}\n\nThis export contains the document(s) you selected — open the \`.html\` file(s) and use **Print → Save as PDF**.\n`,
      "Overview",
    );
  }

  // ── Founder brief — print-ready PDF (architecture + node purposes + prompt strategy) ──
  if (has("founder_brief")) put("founder-brief.html", founderBriefHtml(docsCtx), "Founder brief — open, then Print → Save as PDF");

  // ── Client blueprint — visual, non-technical ──
  if (has("client_blueprint")) put("client-blueprint.html", clientBlueprintHtml(docsCtx), "Client blueprint — open, then Print → Save as PDF");

  // ── manifest + health check (always last) ──
  const healthCheck = buildExportHealthCheck({ pipeline: p, datasets, hasRun: Boolean(run?.runTrace) });
  const manifest: ExportManifest = {
    exportId: newId("export"),
    pipelineId: p.id,
    pipelineName: drop.name,
    exportedAt: new Date().toISOString(),
    exportModes: modes,
    fileCount: files.length + 1,
    files: [...files, { path: "export-manifest.json", type: "json", description: "This manifest" }],
    healthCheck,
  };
  out.push({ path: "export-manifest.json", content: JSON.stringify(manifest, null, 2), type: "json", description: "This manifest" });

  return { files: out, manifest, slug: slugify(drop.name) };
}

/** Build the export ZIP for the selected modes, returning the blob + manifest.
 *  Runs the export safety scanner first — the SAME scanner used by the GitHub PR path — so a ZIP
 *  download can never ship a secret. (Exports are deterministic + token-free by design; this is
 *  defense-in-depth.) Throws a clean error if anything looks like a credential. */
export async function createExportBundle(
  ctx: ExportContext,
  modes: ExportMode[],
): Promise<{ blob: Blob; manifest: ExportManifest; slug: string }> {
  const { files, manifest, slug } = collectExportFiles(ctx, modes);
  assertNoSecretsInExport(files);
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, manifest, slug };
}

/** Build + download the export ZIP. Returns the manifest for history/persistence. */
export async function downloadExportBundle(ctx: ExportContext, modes: ExportMode[]): Promise<ExportManifest> {
  const { blob, manifest, slug } = await createExportBundle(ctx, modes);
  saveAs(blob, `${slug}-flowmind-export.zip`);
  return manifest;
}
