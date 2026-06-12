import { z } from "zod";

/** Tool / API registry. V1 ships definitions (with mock fallbacks); live handlers wire in
 *  later. This is the architecture so complex agent systems can declare what they need. */

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
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const AUTH_TYPES = ["none", "api_key", "oauth", "bearer", "basic"] as const;

export const ioFieldSchema = z.object({
  key: z.string(),
  type: z.string().default("string"),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

export const TOOL_TEST_STATUS = ["untested", "mock", "passing", "failing"] as const;

export const toolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  category: z.enum(TOOL_CATEGORIES),
  authType: z.enum(AUTH_TYPES).default("api_key"),
  requiredEnv: z.array(z.string()).default([]),
  inputSchema: z.array(ioFieldSchema).default([]),
  outputSchema: z.array(ioFieldSchema).default([]),
  handler: z
    .object({
      kind: z.enum(["live", "mock", "none"]).default("mock"),
      endpoint: z.string().optional(),
      method: z.string().optional(),
    })
    .default({ kind: "mock" }),
  testStatus: z.enum(TOOL_TEST_STATUS).default("mock"),
  mockDatasetId: z.string().optional(),
  costNotes: z.string().optional(),
  scope: z.string().optional(),
});
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
