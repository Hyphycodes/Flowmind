import type {
  ContractField,
  ContractWarning,
  FieldMapping,
  TableColumn,
} from "@/lib/pipeline/schema";
import { detectMissingValues, suggestFieldMappings } from "@/lib/datasets/quality";

/** Data Contract = "this source outputs these fields; the next team expects these."
 *  checkDataContract is deterministic and runs without a model. */

export type ContractStatus = "unknown" | "passing" | "warning" | "failing";

export type ContractFieldStatus = {
  key: string;
  type?: string;
  required: boolean;
  expected: boolean;
  provided: boolean;
  emptyRate?: number;
  issue?: "missing" | "type_mismatch" | "unused" | "empty" | "low_quality" | "ambiguous";
  mappedFrom?: string;
};

export type DataContractReport = {
  status: ContractStatus;
  summary: string;
  fields: ContractFieldStatus[];
  warnings: ContractWarning[];
  suggestedMappings: FieldMapping[];
};

export type CheckContractInput = {
  sourceSchema: TableColumn[];
  rows?: Record<string, unknown>[];
  targetExpectedSchema: ContractField[];
  mappings?: FieldMapping[];
  fromNodeId?: string;
  toNodeId?: string;
};

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function checkDataContract(input: CheckContractInput): DataContractReport {
  const { sourceSchema, rows = [], targetExpectedSchema, mappings = [] } = input;
  const sourceByNorm = new Map(sourceSchema.map((c) => [norm(c.key), c.key]));
  const mappedTargets = new Map(mappings.map((m) => [m.targetField, m.sourceField]));
  const emptyByKey = new Map(detectMissingValues(sourceSchema, rows).map((m) => [m.key, m.emptyRate]));

  const fields: ContractFieldStatus[] = [];
  const warnings: ContractWarning[] = [];
  const expectedKeys = new Set<string>();

  // Auto-suggest mappings for any expected field not directly present.
  const suggested = suggestFieldMappings(
    sourceSchema,
    targetExpectedSchema.map((f) => ({ key: f.key })),
    { fromNodeId: input.fromNodeId, toNodeId: input.toNodeId },
  );
  const suggestedByTarget = new Map(suggested.map((m) => [m.targetField, m.sourceField]));

  for (const field of targetExpectedSchema) {
    expectedKeys.add(field.key);
    const directKey = sourceByNorm.get(norm(field.key));
    const mappedFrom = mappedTargets.get(field.key) ?? (directKey ? undefined : suggestedByTarget.get(field.key));
    const provided = Boolean(directKey) || mappedTargets.has(field.key);
    const resolvedKey = directKey ?? mappedTargets.get(field.key);
    const emptyRate = resolvedKey ? emptyByKey.get(resolvedKey) : undefined;

    let issue: ContractFieldStatus["issue"];
    if (!provided && mappedFrom) {
      issue = "ambiguous";
      warnings.push({
        severity: field.required ? "warning" : "info",
        field: field.key,
        message: `Target expects \`${field.key}\` — source provides \`${mappedFrom}\`. Apply a mapping.`,
      });
    } else if (!provided) {
      issue = "missing";
      warnings.push({
        severity: field.required ? "error" : "warning",
        field: field.key,
        message: `${field.required ? "Required field" : "Field"} \`${field.key}\` is not provided by this source.`,
      });
    } else if (field.required && typeof emptyRate === "number" && emptyRate > 0.25) {
      issue = "empty";
      warnings.push({
        severity: "warning",
        field: field.key,
        message: `\`${field.key}\` is ${Math.round(emptyRate * 100)}% empty across rows.`,
      });
    }

    fields.push({
      key: field.key,
      type: field.type,
      required: field.required,
      expected: true,
      provided: provided || Boolean(mappedFrom),
      emptyRate,
      issue,
      mappedFrom: mappedTargets.has(field.key) ? mappedTargets.get(field.key) : mappedFrom,
    });
  }

  // Unused source fields (info only).
  for (const col of sourceSchema) {
    if (expectedKeys.has(col.key)) continue;
    const isMappedSource = mappings.some((m) => m.sourceField === col.key) ||
      suggested.some((m) => m.sourceField === col.key);
    if (isMappedSource) continue;
    fields.push({ key: col.key, type: col.type, required: false, expected: false, provided: true, issue: "unused" });
  }

  const hasError = warnings.some((w) => w.severity === "error");
  const hasWarning = warnings.some((w) => w.severity === "warning");
  const status: ContractStatus = !targetExpectedSchema.length
    ? "unknown"
    : hasError
      ? "failing"
      : hasWarning
        ? "warning"
        : "passing";

  const missingCount = fields.filter((f) => f.expected && !f.provided).length;
  const summary =
    status === "passing"
      ? `All ${targetExpectedSchema.length} expected field(s) provided.`
      : status === "unknown"
        ? "No downstream expectations declared."
        : `${missingCount} field issue(s); ${warnings.length} warning(s).`;

  return { status, summary, fields, warnings, suggestedMappings: suggested };
}

/** Map a contract status to the edge accent used in the canvas + inspector. */
export function contractStatusColor(status: ContractStatus): string | undefined {
  switch (status) {
    case "passing":
      return "#34d399";
    case "warning":
      return "#f5c451";
    case "failing":
      return "#f87171";
    default:
      return undefined;
  }
}
