import type { OutputTable } from "@/lib/pipeline/schema";
import { datasetSchema, type Dataset } from "./schema";
import { newId } from "@/lib/pipeline/validate";
import { inferDatasetSchema, scoreDatasetQuality } from "./quality";

/** Client-safe dataset helpers (no AI SDK imports — safe in the browser bundle). */

/** Recompute schema (if empty) + quality score for a dataset. */
export function enrichDataset(d: Dataset): Dataset {
  const schema = d.schema.length ? d.schema : inferDatasetSchema(d.rows);
  return datasetSchema.parse({
    ...d,
    schema,
    qualityScore: scoreDatasetQuality(schema, d.rows, d.requiredFields),
  });
}

/** Snapshot an output table into a reusable Dataset (Previous Take → Source). */
export function datasetFromTable(
  table: OutputTable,
  opts?: { name?: string; mode?: Dataset["mode"]; takeName?: string; scenarioTags?: string[] },
): Dataset {
  const schema = table.columns.length ? table.columns : inferDatasetSchema(table.rows);
  return datasetSchema.parse({
    id: newId("ds"),
    name: opts?.name ?? `${table.name} snapshot`,
    description: opts?.takeName
      ? `Snapshot of \`${table.name}\` from ${opts.takeName}.`
      : `Snapshot of the \`${table.name}\` output table.`,
    mode: opts?.mode ?? "previous_take",
    schema,
    rows: table.rows,
    scenarioTags: opts?.scenarioTags ?? [],
    requiredFields: [],
    qualityScore: scoreDatasetQuality(schema, table.rows),
    version: 1,
  });
}

/** Turn a dataset into an output table for a given source node. */
export function tableFromDataset(d: Dataset, nodeId: string, tableId?: string): OutputTable {
  return {
    id: tableId ?? d.id,
    name: tableId ?? d.name,
    sourceNodeId: nodeId,
    description: d.description,
    columns: d.schema,
    rows: d.rows,
    rowCount: d.rows.length,
    qualityScore: d.qualityScore,
  };
}
