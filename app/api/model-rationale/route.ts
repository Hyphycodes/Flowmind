import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel, hasAnthropicKey } from "@/lib/ai/anthropic";
import { tryLoadPrompt } from "@/lib/prompts";
import { wiredModels } from "@/lib/models/providers";
import { safeApiError, requireAuthedAI } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  recommendedModelId: z.string(),
  rationale: z.string(),
  keepCurrent: z.boolean().default(false),
});

/** Optional AI rationale for a model recommendation (Task 01b). The optimizer's heuristic + estimate
 *  work without this — it just phrases the "why this model" in plain language. Gated on a key. */
// Requires auth + per-user rate limiting: spends provider tokens (real Claude rationale).
export async function POST(req: Request) {
  const guard = await requireAuthedAI();
  if (guard instanceof Response) return guard;

  if (!hasAnthropicKey()) {
    return Response.json({ error: "AI key required." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as { node?: unknown; observed?: unknown };
  if (!b.node || typeof b.node !== "object") return Response.json({ error: "Missing node." }, { status: 400 });

  const prompt = tryLoadPrompt("08-model-picker");
  if (!prompt) return Response.json({ error: "Model picker unavailable." }, { status: 500 });

  const candidates = wiredModels().map((m) => ({
    id: m.id,
    displayName: m.displayName,
    tier: m.costTier,
    speed: m.speedTier,
    goodAt: m.recommendedFor,
  }));

  try {
    const { object } = await generateObject({
      model: anthropicModel(),
      schema,
      system: prompt,
      prompt: JSON.stringify({ node: b.node, observed: b.observed ?? null, candidates }),
      temperature: 0.3,
      maxRetries: 1,
    });
    return Response.json(object);
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Couldn't generate a rationale.") }, { status: 500 });
  }
}
