import type { Dataset } from "./schema";
import { datasetSchema } from "./schema";
import {
  detectDuplicateRows,
  inferDatasetSchema,
  scoreDatasetQuality,
} from "./quality";

/** Lightweight, deterministic Data Repair actions. Each returns a new Dataset
 *  (and rescored) — never mutates in place, never fabricates fancy values. */

type Row = Record<string, unknown>;

function rescore(d: Dataset, rows: Row[], schema = d.schema): Dataset {
  return datasetSchema.parse({
    ...d,
    schema,
    rows,
    qualityScore: scoreDatasetQuality(schema, rows, d.requiredFields),
    updatedAt: new Date().toISOString(),
  });
}

function snakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

/** Normalize all field names to snake_case across schema + rows. */
export function normalizeFieldNames(d: Dataset): Dataset {
  const rename = new Map<string, string>();
  for (const col of d.schema) rename.set(col.key, snakeCase(col.key));
  for (const row of d.rows) for (const k of Object.keys(row)) if (!rename.has(k)) rename.set(k, snakeCase(k));

  const schema = d.schema.map((c) => ({ ...c, key: rename.get(c.key) ?? c.key }));
  const rows = d.rows.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) out[rename.get(k) ?? k] = v;
    return out;
  });
  return rescore(d, rows, schema);
}

/** Fill empty cells with type-appropriate defaults (0 for numeric, "" otherwise). */
export function fillMissingValues(d: Dataset): Dataset {
  const typeOf = new Map(d.schema.map((c) => [c.key, c.type]));
  const rows = d.rows.map((row) => {
    const out: Row = { ...row };
    for (const col of d.schema) {
      const v = out[col.key];
      if (v === null || v === undefined || v === "") {
        const t = typeOf.get(col.key);
        out[col.key] = t === "number" || t === "currency" || t === "percent" ? 0 : "";
      }
    }
    return out;
  });
  return rescore(d, rows);
}

/** Drop rows that duplicate an earlier row. */
export function removeDuplicateRows(d: Dataset): Dataset {
  const dupes = new Set(detectDuplicateRows(d.rows));
  const rows = d.rows.filter((_, i) => !dupes.has(i));
  return rescore(d, rows);
}

/** Re-infer the column schema from the current rows. */
export function reinferSchema(d: Dataset): Dataset {
  const schema = inferDatasetSchema(d.rows);
  return rescore(d, d.rows, schema);
}

export type RepairAction = "normalize" | "fill" | "dedupe" | "infer";

export const REPAIR_ACTIONS: { id: RepairAction; label: string; hint: string }[] = [
  { id: "normalize", label: "Normalize field names", hint: "snake_case every column key" },
  { id: "fill", label: "Fill missing values", hint: "0 for numbers, empty string otherwise" },
  { id: "dedupe", label: "Remove duplicate rows", hint: "drop exact repeat rows" },
  { id: "infer", label: "Re-infer schema", hint: "rebuild column types from the data" },
];

export function applyRepair(d: Dataset, action: RepairAction): Dataset {
  switch (action) {
    case "normalize":
      return normalizeFieldNames(d);
    case "fill":
      return fillMissingValues(d);
    case "dedupe":
      return removeDuplicateRows(d);
    case "infer":
      return reinferSchema(d);
    default:
      return d;
  }
}
