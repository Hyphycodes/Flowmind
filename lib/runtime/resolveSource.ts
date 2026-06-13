import type { OutputTable, PipelineNode } from "@/lib/pipeline/schema";
import type { Dataset } from "@/lib/datasets/schema";

/** Resolve a source node's output tables. In simulate/hybrid, prefer a bound dataset,
 *  then a seeded table, then a 1-row table from the input. Live tool calls go through
 *  a tool adapter (not included here — the portable runtime stays dependency-free). */
export function resolveSource(
  node: PipelineNode,
  input: Record<string, unknown>,
  seed: Map<string, OutputTable>,
  datasets: Dataset[] = [],
): OutputTable[] {
  const keys = node.outputs.length ? node.outputs : [node.id];
  const dataset = node.source?.datasetId ? datasets.find((d) => d.id === node.source!.datasetId) : undefined;

  return keys.map((key) => {
    if (dataset) {
      return { id: key, name: key, sourceNodeId: node.id, description: dataset.description, columns: dataset.schema, rows: dataset.rows };
    }
    const seeded = seed.get(key);
    if (seeded) return { ...seeded, sourceNodeId: node.id };
    return {
      id: key,
      name: key,
      sourceNodeId: node.id,
      description: "",
      columns: Object.keys(input).map((k) => ({ key: k, label: k, type: "text" as const })),
      rows: [input],
    };
  });
}
