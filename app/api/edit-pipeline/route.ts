import { generateObject } from "ai";
import { anthropicModel, hasAnthropicKey } from "@/lib/ai/anthropic";
import { pipelineSchema } from "@/lib/pipeline/schema";
import { editProposalSchema, screenChanges } from "@/lib/pipeline/editDiff";
import { tryLoadPrompt } from "@/lib/prompts";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!hasAnthropicKey()) {
    // No fake diffs — edits require a real model.
    return Response.json({ error: "An Anthropic API key is required to edit a pipeline by talking." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as { pipeline?: unknown; request?: unknown; remixAction?: unknown; selectedNodeId?: unknown };

  const parsed = pipelineSchema.safeParse(b.pipeline);
  if (!parsed.success) return Response.json({ error: "Invalid pipeline" }, { status: 400 });
  const pipeline = parsed.data;
  const request = typeof b.request === "string" ? b.request.trim() : "";
  const remixAction = typeof b.remixAction === "string" ? b.remixAction : undefined;
  const selectedNodeId =
    typeof b.selectedNodeId === "string" && pipeline.nodes.some((n) => n.id === b.selectedNodeId) ? b.selectedNodeId : undefined;
  if (!request && !remixAction) {
    return Response.json({ error: "Describe the change you want." }, { status: 400 });
  }

  const system = tryLoadPrompt("02-editor");
  if (!system) return Response.json({ error: "Editor unavailable." }, { status: 500 });

  // Slim the pipeline the model reasons over (it doesn't need run/product cruft).
  const slim = {
    name: pipeline.name,
    nodes: pipeline.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      role: n.role,
      prompt: n.prompt,
      model: n.model,
      inputs: n.inputs,
      outputs: n.outputs,
      team: n.team ? { strategy: n.team.strategy, members: n.team.agents.filter((a) => !a.isController).map((a) => a.id) } : undefined,
    })),
    edges: pipeline.edges.map((e) => ({ source: e.source, target: e.target, dataKey: e.dataKey })),
  };

  try {
    const { object } = await generateObject({
      model: anthropicModel(),
      schema: editProposalSchema,
      system,
      prompt: JSON.stringify({ pipeline: slim, request, remixAction, selectedNodeId }),
      temperature: 0.3,
      maxRetries: 1,
    });
    // Server-side screen: drop any change that would break the graph if applied to the base.
    const changes = screenChanges(pipeline, object.changes);
    return Response.json({ changes });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Could not propose edits.") }, { status: 500 });
  }
}
