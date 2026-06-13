/** Adapter contracts for live execution (future @flowmind/sdk). The portable runtime
 *  runs in simulate mode without these; wire them to call real models/tools. */
export type ToolAdapter = (toolId: string, input: Record<string, unknown>) => Promise<unknown>;
export type ModelAdapter = (opts: { modelId: string; system?: string; prompt: string }) => Promise<string>;

export const noopToolAdapter: ToolAdapter = async (toolId) => {
  throw new Error(`No tool adapter wired for "${toolId}". Implement one to enable live tool calls.`);
};

export const noopModelAdapter: ModelAdapter = async ({ modelId }) => {
  throw new Error(`No model adapter wired for "${modelId}". Implement one to enable live model calls.`);
};
