import { toolDefinitionSchema, type ToolCategory, type ToolDefinition } from "./schema";

const RAW = [
  {
    id: "serpapi_search",
    name: "Web Search (SerpAPI)",
    description: "General web search results for research and enrichment.",
    category: "web_search",
    requiredEnv: ["SERPAPI_API_KEY"],
    inputSchema: [{ key: "query", type: "string", required: true }],
    outputSchema: [{ key: "results", type: "array" }],
    costNotes: "~$0.01 / search",
  },
  {
    id: "google_places",
    name: "Google Places",
    description: "Find places, ratings, and details by query or location.",
    category: "places",
    requiredEnv: ["GOOGLE_PLACES_API_KEY"],
    inputSchema: [
      { key: "query", type: "string", required: true },
      { key: "location", type: "string" },
    ],
    outputSchema: [{ key: "places", type: "array" }],
  },
  {
    id: "rentcast",
    name: "RentCast",
    description: "Rent estimates and comps for residential property.",
    category: "real_estate",
    requiredEnv: ["RENTCAST_API_KEY"],
    inputSchema: [{ key: "address", type: "string", required: true }],
    outputSchema: [{ key: "rent_estimate", type: "object" }, { key: "comps", type: "array" }],
  },
  {
    id: "attom",
    name: "ATTOM Property Data",
    description: "Property details, AVMs, and sales history.",
    category: "real_estate",
    requiredEnv: ["ATTOM_API_KEY"],
    inputSchema: [{ key: "address", type: "string", required: true }],
    outputSchema: [{ key: "property", type: "object" }],
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Read and draft email messages.",
    category: "email",
    authType: "oauth",
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
    inputSchema: [{ key: "query", type: "string" }],
    outputSchema: [{ key: "messages", type: "array" }],
    scope: "gmail.readonly, gmail.compose",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Read availability and create events.",
    category: "calendar",
    authType: "oauth",
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID"],
    inputSchema: [{ key: "timeMin", type: "string" }, { key: "timeMax", type: "string" }],
    outputSchema: [{ key: "events", type: "array" }],
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Read/write tabular data to a spreadsheet.",
    category: "sheets",
    authType: "oauth",
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID"],
    inputSchema: [{ key: "spreadsheetId", type: "string", required: true }],
    outputSchema: [{ key: "rows", type: "array" }],
  },
  {
    id: "supabase_table",
    name: "Supabase Table",
    description: "Query or upsert rows in a Supabase table.",
    category: "database",
    authType: "api_key",
    requiredEnv: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    inputSchema: [{ key: "table", type: "string", required: true }, { key: "query", type: "object" }],
    outputSchema: [{ key: "rows", type: "array" }],
  },
  {
    id: "custom_http",
    name: "Custom HTTP",
    description: "Call any REST endpoint with a declared input/output schema.",
    category: "custom_http",
    authType: "bearer",
    requiredEnv: [],
    inputSchema: [{ key: "url", type: "string", required: true }, { key: "body", type: "object" }],
    outputSchema: [{ key: "response", type: "object" }],
  },
  {
    id: "webhook_out",
    name: "Outbound Webhook",
    description: "POST a structured payload to an external webhook.",
    category: "webhook",
    authType: "none",
    inputSchema: [{ key: "url", type: "string", required: true }, { key: "payload", type: "object" }],
    outputSchema: [{ key: "status", type: "number" }],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Create checkout sessions, read customers and invoices.",
    category: "payments",
    requiredEnv: ["STRIPE_SECRET_KEY"],
    inputSchema: [{ key: "action", type: "string", required: true }],
    outputSchema: [{ key: "result", type: "object" }],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages and notifications to channels.",
    category: "messaging",
    authType: "oauth",
    requiredEnv: ["SLACK_BOT_TOKEN"],
    inputSchema: [{ key: "channel", type: "string", required: true }, { key: "text", type: "string", required: true }],
    outputSchema: [{ key: "ok", type: "boolean" }],
  },
] as const;

export const TOOLS: ToolDefinition[] = RAW.map((t) => toolDefinitionSchema.parse(t));

export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOLS.filter((t) => t.category === category);
}
