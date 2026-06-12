import { z } from "zod";

/** Tool / API registry. Tools are first-class but secrets stay server-side; client
 *  surfaces receive status booleans and missing env names only. */

export const TOOL_CATEGORIES = [
  "web_search",
  "places",
  "real_estate",
  "email",
  "calendar",
  "files",
  "sheets",
  "crm",
  "database",
  "custom_http",
  "webhook",
  "payments",
  "messaging",
  "memory",
  "dataset",
  "developer",
  "other",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const AUTH_TYPES = [
  "none",
  "api_key",
  "bearer_token",
  "basic",
  "oauth",
  "env_var",
  "custom",
] as const;
export type ToolAuthType = (typeof AUTH_TYPES)[number];

export const TOOL_STATUSES = ["ready", "missing_key", "disabled", "error", "unknown"] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export const TOOL_TEST_STATUS = ["untested", "mock", "passing", "failing"] as const;

export const ioFieldSchema = z.object({
  key: z.string(),
  type: z.string().default("string"),
  required: z.boolean().default(false),
  description: z.string().optional(),
});
export type IOField = z.infer<typeof ioFieldSchema>;

export const toolPermissionSchema = z.object({
  scope: z.string(),
  label: z.string(),
  description: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
});
export type ToolPermission = z.infer<typeof toolPermissionSchema>;

export const toolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  category: z.enum(TOOL_CATEGORIES),
  authType: z.enum(AUTH_TYPES).default("api_key"),
  requiredEnvVars: z.array(z.string()).default([]),
  /** Backward-compatible alias from earlier registry passes. */
  requiredEnv: z.array(z.string()).default([]),
  inputSchema: z.union([z.array(ioFieldSchema), z.record(z.unknown())]).default([]),
  outputSchema: z.union([z.array(ioFieldSchema), z.record(z.unknown())]).default([]),
  permissions: z.array(toolPermissionSchema).default([]),
  rateLimitNotes: z.string().optional(),
  costNotes: z.string().optional(),
  enabled: z.boolean().default(true),
  status: z.enum(TOOL_STATUSES).default("unknown"),
  testable: z.boolean().default(false),
  mockable: z.boolean().default(true),
  mockDatasetId: z.string().optional(),
  fallbackSourceMode: z.string().optional(),
  fallbackDatasetId: z.string().optional(),
  liveHandler: z
    .object({
      type: z.enum(["custom_http", "internal", "provider_sdk", "webhook"]),
      endpoint: z.string().optional(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
      baseUrlEnvVar: z.string().optional(),
    })
    .optional(),
  /** Backward-compatible handler shape. */
  handler: z
    .object({
      kind: z.enum(["live", "mock", "none"]).default("mock"),
      endpoint: z.string().optional(),
      method: z.string().optional(),
    })
    .optional(),
  testStatus: z.enum(TOOL_TEST_STATUS).default("mock"),
  scope: z.string().optional(),
});
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

export function envVarsForTool(tool: ToolDefinition): string[] {
  return Array.from(new Set([...(tool.requiredEnvVars ?? []), ...(tool.requiredEnv ?? [])]));
}

export function fieldsToRecord(fields: ToolDefinition["inputSchema"]): Record<string, unknown> {
  if (Array.isArray(fields)) {
    return Object.fromEntries(
      fields.map((field) => [field.key, { type: field.type, required: field.required, description: field.description }]),
    );
  }
  return fields;
}
