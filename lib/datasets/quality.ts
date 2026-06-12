import type { FieldMapping, TableColumn } from "@/lib/pipeline/schema";
import { newId } from "@/lib/pipeline/validate";

/** Deterministic Input Studio quality utilities.
 *  These run first — without any model — so dataset quality, schema inference,
 *  duplicate detection, and field mapping are reliable and offline-safe. */

type Row = Record<string, unknown>;
type ColType = TableColumn["type"];

const EMPTY = (v: unknown) => v === null || v === undefined || v === "";

function looksNumeric(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string" && v.trim() !== "") return !Number.isNaN(Number(v.replace(/[$,%]/g, "")));
  return false;
}

function looksDate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  if (!/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) return false;
  return !Number.isNaN(Date.parse(v));
}

function inferType(values: unknown[]): ColType {
  const present = values.filter((v) => !EMPTY(v));
  if (present.length === 0) return "text";
  if (present.every((v) => typeof v === "boolean")) return "badge";
  if (present.every(looksDate)) return "date";
  if (present.every(looksNumeric)) {
    if (present.some((v) => typeof v === "string" && /%/.test(v))) return "percent";
    if (present.some((v) => typeof v === "string" && /\$/.test(v))) return "currency";
    return "number";
  }
  return "text";
}

function prettyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Infer a column schema from raw rows (keys in first-seen order). */
export function inferDatasetSchema(rows: Row[]): TableColumn[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row ?? {})) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys.map((key) => ({
    key,
    label: prettyLabel(key),
    type: inferType(rows.map((r) => r?.[key])),
  }));
}

export type MissingValueReport = { key: string; emptyRate: number; emptyCount: number };

/** Empty-value rate per column (0..1). */
export function detectMissingValues(schema: TableColumn[], rows: Row[]): MissingValueReport[] {
  const cols = schema.length ? schema.map((c) => c.key) : Object.keys(rows[0] ?? {});
  if (!rows.length) return cols.map((key) => ({ key, emptyRate: 0, emptyCount: 0 }));
  return cols.map((key) => {
    const emptyCount = rows.reduce((n, r) => n + (EMPTY(r?.[key]) ? 1 : 0), 0);
    return { key, emptyRate: emptyCount / rows.length, emptyCount };
  });
}

/** Indices of rows that duplicate an earlier row (by `keys`, or all columns). */
export function detectDuplicateRows(rows: Row[], keys?: string[]): number[] {
  const useKeys = keys?.length ? keys : Object.keys(rows[0] ?? {});
  const sigs = new Map<string, number>();
  const dupes: number[] = [];
  rows.forEach((row, i) => {
    const sig = JSON.stringify(useKeys.map((k) => row?.[k] ?? null));
    if (sigs.has(sig)) dupes.push(i);
    else sigs.set(sig, i);
  });
  return dupes;
}

export type DatasetIssue = {
  kind: "missing_required" | "type_mismatch" | "duplicate" | "empty";
  field?: string;
  row?: number;
  message: string;
};

/** Validate rows against a schema + optional required fields. Deterministic. */
export function validateDatasetRows(
  schema: TableColumn[],
  rows: Row[],
  requiredFields: string[] = [],
): { ok: boolean; issues: DatasetIssue[] } {
  const issues: DatasetIssue[] = [];
  const required = new Set(requiredFields);

  for (const col of schema) {
    if (!required.has(col.key)) continue;
    rows.forEach((row, i) => {
      if (EMPTY(row?.[col.key]))
        issues.push({ kind: "missing_required", field: col.key, row: i, message: `Row ${i + 1} is missing required \`${col.key}\`.` });
    });
  }

  for (const col of schema.filter((c) => c.type === "number" || c.type === "currency" || c.type === "percent")) {
    rows.forEach((row, i) => {
      const v = row?.[col.key];
      if (!EMPTY(v) && !looksNumeric(v))
        issues.push({ kind: "type_mismatch", field: col.key, row: i, message: `Row ${i + 1} field \`${col.key}\` should be numeric.` });
    });
  }

  for (const i of detectDuplicateRows(rows))
    issues.push({ kind: "duplicate", row: i, message: `Row ${i + 1} duplicates an earlier row.` });

  return { ok: issues.length === 0, issues };
}

/** 0–100 dataset quality: fill rate, type consistency, dedupe, row count, required coverage. */
export function scoreDatasetQuality(
  schema: TableColumn[],
  rows: Row[],
  requiredFields: string[] = [],
): number {
  if (!rows.length || !schema.length) return 0;

  const missing = detectMissingValues(schema, rows);
  const avgEmpty = missing.reduce((s, m) => s + m.emptyRate, 0) / Math.max(missing.length, 1);
  const fillScore = 1 - avgEmpty; // 0..1

  let typedCells = 0;
  let consistentCells = 0;
  for (const col of schema.filter((c) => c.type !== "text" && c.type !== "badge")) {
    for (const row of rows) {
      const v = row?.[col.key];
      if (EMPTY(v)) continue;
      typedCells += 1;
      if (col.type === "date" ? looksDate(v) : looksNumeric(v)) consistentCells += 1;
    }
  }
  const typeScore = typedCells ? consistentCells / typedCells : 1; // 0..1

  const dupeRate = detectDuplicateRows(rows).length / rows.length;
  const dupeScore = 1 - dupeRate; // 0..1

  const countScore = Math.min(rows.length / 12, 1); // ramps to full at ~12 rows

  const requiredCoverage = requiredFields.length
    ? requiredFields.filter((f) => schema.some((c) => c.key === f)).length / requiredFields.length
    : 1;

  const score =
    fillScore * 0.4 + typeScore * 0.25 + dupeScore * 0.15 + countScore * 0.1 + requiredCoverage * 0.1;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

/* ── Field mapping suggestions ───────────────────────────────────────── */

const SYNONYMS: Record<string, string[]> = {
  name: ["place_name", "title", "label", "place", "full_name"],
  address: ["addr", "street", "location_address"],
  rating: ["stars", "score", "rank_score"],
  price: ["price_level", "cost", "price_range"],
  parking: ["parking_notes", "parking_info"],
  distance: ["distance_minutes", "drive_minutes", "miles", "dist"],
  category: ["cuisine", "type", "kind"],
  review_count: ["reviews", "num_reviews", "ratings_count"],
  phone: ["phone_number", "tel", "contact"],
  open_now: ["is_open", "open"],
};

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function singular(k: string): string {
  return k.replace(/s$/, "");
}

/** Score how well two field names match (0 = none, 1 = exact). */
function matchScore(source: string, target: string): number {
  const s = normalizeKey(source);
  const t = normalizeKey(target);
  if (s === t) return 1;
  if (singular(s) === singular(t)) return 0.92;
  const syn = SYNONYMS[target.toLowerCase()] ?? [];
  if (syn.some((x) => normalizeKey(x) === s)) return 0.85;
  const synS = SYNONYMS[source.toLowerCase()] ?? [];
  if (synS.some((x) => normalizeKey(x) === t)) return 0.85;
  if (s.includes(t) || t.includes(s)) return 0.7;
  return 0;
}

/** Suggest field mappings from a source schema to a target's expected fields. */
export function suggestFieldMappings(
  sourceSchema: { key: string }[],
  targetSchema: { key: string }[],
  ctx?: { fromNodeId?: string; toNodeId?: string },
): FieldMapping[] {
  const sourceKeys = new Set(sourceSchema.map((c) => c.key));
  const mappings: FieldMapping[] = [];

  for (const target of targetSchema) {
    if (sourceKeys.has(target.key)) continue; // already a direct match
    let best: { key: string; score: number } | null = null;
    for (const source of sourceSchema) {
      const score = matchScore(source.key, target.key);
      if (score > 0.6 && (!best || score > best.score)) best = { key: source.key, score };
    }
    if (best) {
      mappings.push({
        id: newId("map"),
        fromNodeId: ctx?.fromNodeId ?? "",
        toNodeId: ctx?.toNodeId ?? "",
        sourceField: best.key,
        targetField: target.key,
        transform: "none",
      });
    }
  }
  return mappings;
}
