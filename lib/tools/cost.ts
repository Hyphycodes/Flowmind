import { getTool } from "./registry";

export function estimateToolCost(toolId: string, usage?: { calls?: number }): number | undefined {
  const tool = getTool(toolId);
  if (!tool) return undefined;
  const notes = tool.costNotes?.match(/\$([0-9.]+)/);
  if (!notes?.[1]) return undefined;
  const unitCost = Number(notes[1]);
  if (!Number.isFinite(unitCost)) return undefined;
  return unitCost * (usage?.calls ?? 1);
}
