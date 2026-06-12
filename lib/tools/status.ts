import { TOOLS } from "./registry";
import { envVarsForTool, type ToolDefinition, type ToolStatus } from "./schema";

export type ToolStatusRow = {
  id: string;
  name: string;
  category: ToolDefinition["category"];
  status: ToolStatus;
  missingEnvVars: string[];
  enabled: boolean;
  authType: ToolDefinition["authType"];
  fallbackDatasetId?: string;
  mockable: boolean;
};

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function statusForTool(tool: ToolDefinition): ToolStatusRow {
  const missingEnvVars = envVarsForTool(tool).filter((name) => !hasEnv(name));
  const status: ToolStatus = !tool.enabled
    ? "disabled"
    : missingEnvVars.length
      ? "missing_key"
      : "ready";
  return {
    id: tool.id,
    name: tool.name,
    category: tool.category,
    status,
    missingEnvVars,
    enabled: tool.enabled,
    authType: tool.authType,
    fallbackDatasetId: tool.fallbackDatasetId ?? tool.mockDatasetId,
    mockable: tool.mockable,
  };
}

export function toolStatuses(): ToolStatusRow[] {
  return TOOLS.map(statusForTool);
}

export function isToolReady(toolId: string): boolean {
  return toolStatuses().some((tool) => tool.id === toolId && tool.status === "ready");
}
