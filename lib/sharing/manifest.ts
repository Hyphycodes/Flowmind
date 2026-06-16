import type { Pipeline } from "@/lib/pipeline/schema";
import type { PricingMode, ShareLevel } from "./schema";

/** The ONLY pipeline data a Run-App client is allowed to receive. Built server-side. Contains no
 *  prompts, no model config, no tool credentials, no data sources, no node internals — just the
 *  input fields to collect and the output surfaces to render. Keep it that way. */

export type RunAppField = { key: string; label: string; placeholder?: string };
export type RunAppBinding = { tableId: string; componentType: string; title: string; fields: string[] };
/** For `view` level only: a stripped structure (titles/types/edges) — never prompts/sources. */
export type RunAppStructureNode = { id: string; title: string; type: string };
export type RunAppStructureEdge = { source: string; target: string };

export type RunAppManifest = {
  pipelineId: string;
  name: string;
  description: string;
  level: ShareLevel;
  fields: RunAppField[];
  bindings: RunAppBinding[];
  outputTableIds: string[];
  /** present only at `view` level */
  structure?: { nodes: RunAppStructureNode[]; edges: RunAppStructureEdge[] };
  /** pricing the requester pays (not sensitive) — drives the paywall (Task 05b) */
  pricing?: { mode: PricingMode; amountUsd: number; currency: string; captureInputValues?: boolean };
};

export function toRunAppManifest(
  p: Pipeline,
  level: ShareLevel,
  pricing?: { mode: PricingMode; amountUsd: number; currency: string; captureInputValues?: boolean },
): RunAppManifest {
  const manifest: RunAppManifest = {
    pipelineId: p.id,
    name: p.name,
    description: p.description,
    level,
    fields: p.mockInputs.map((f) => ({ key: f.key, label: f.label, placeholder: f.placeholder })),
    bindings: p.uiBindings.map((b) => ({
      tableId: b.tableId,
      componentType: b.componentType,
      title: b.title,
      fields: b.fields,
    })),
    outputTableIds: [...new Set(p.uiBindings.map((b) => b.tableId))],
    pricing: pricing && pricing.mode !== "free" ? pricing : undefined,
  };
  // `run` reveals neither the structure nor any internals — only the form + results.
  if (level === "view") {
    manifest.structure = {
      nodes: p.nodes.map((n) => ({ id: n.id, title: n.title, type: n.type })),
      edges: p.edges.map((e) => ({ source: e.source, target: e.target })),
    };
  }
  return manifest;
}
