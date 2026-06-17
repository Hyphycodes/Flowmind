import { generateObject } from "ai";
import { anthropicModel, hasAnthropicKey } from "@/lib/ai/anthropic";
import { pipelineSchema } from "@/lib/pipeline/schema";
import { editProposalSchema, screenChanges } from "@/lib/pipeline/editDiff";
import { builderPreferencesSchema, preferencesToPromptBlock } from "@/lib/preferences/schema";
import { tryLoadPrompt } from "@/lib/prompts";
import { safeApiError, requireAuthedAI } from "@/lib/api/guards";
import { getBillingAccount, recordEditSpend } from "@/lib/billing/usage";
import { canEditPipeline } from "@/lib/billing/featureGates";

export const runtime = "nodejs";
export const maxDuration = 120;

// Requires auth + per-user rate limiting: spends provider tokens (real Claude edit diffs).
// Metered against the EDITS pool (Prompt 20) — separate from the runs pool.
export async function POST(req: Request) {
  const guard = await requireAuthedAI();
  if (guard instanceof Response) return guard;

  // Edits pool gate (no-op unless billing is enabled). 402 → the client opens the upgrade modal.
  const editAccount = await getBillingAccount();
  const editGate = canEditPipeline(editAccount, "edit");
  if (!editGate.allowed) {
    return Response.json({ error: editGate.reason ?? "Out of AI edits", gate: editGate, pool: "edits" }, { status: 402 });
  }

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
  const b = (body ?? {}) as {
    pipeline?: unknown;
    request?: unknown;
    remixAction?: unknown;
    selectedNodeId?: unknown;
    preferences?: unknown;
  };

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

  const base = tryLoadPrompt("02-editor");
  if (!base) return Response.json({ error: "Editor unavailable." }, { status: 500 });
  // Builder preferences → soft guidance (nudges, never overrides the explicit request).
  const prefs = builderPreferencesSchema.safeParse(b.preferences);
  const guidance = prefs.success ? preferencesToPromptBlock(prefs.data) : null;
  const system = guidance ? `${base}\n\n${guidance}` : base;

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
    // Surgical editing (19b): if the model couldn't pin the target, ask instead of guessing.
    // A clarifying question still consumed one AI call — meter it.
    if (object.clarify && object.changes.length === 0) {
      await recordEditSpend();
      return Response.json({ clarify: object.clarify, clarifyOptions: object.clarifyOptions ?? [] });
    }
    // Server-side screen: drop any change that would break the graph (cycle/orphan/invalid).
    const changes = screenChanges(pipeline, object.changes);
    // Success → decrement the edits pool exactly once (failed calls below never reach here).
    await recordEditSpend();
    return Response.json({ changes });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Could not propose edits.") }, { status: 500 });
  }
}
