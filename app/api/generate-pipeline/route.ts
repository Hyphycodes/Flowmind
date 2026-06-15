import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { generateArchitectPipeline } from "@/lib/pipeline/architect";
import { isEffort, type EffortLevel } from "@/lib/pipeline/effort";
import { instantiatePipeline, matchTemplate } from "@/lib/pipeline/fixtures";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = (body ?? {}) as { description?: unknown; effort?: unknown };
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const effort: EffortLevel = isEffort(raw.effort) ? raw.effort : "balanced";
  if (!description) {
    return Response.json(
      { error: "Describe the AI system you want to build." },
      { status: 400 },
    );
  }

  if (!hasAnthropicKey()) {
    const t = matchTemplate(description);
    return Response.json({
      pipeline: instantiatePipeline(t.pipeline, t.pipeline.name),
      source: "template",
      effort,
      note: "Used a built-in template — set ANTHROPIC_API_KEY for custom AI generation.",
    });
  }

  try {
    const pipeline = await generateArchitectPipeline(description, effort);
    return Response.json({ pipeline, source: "ai", effort });
  } catch (err) {
    const t = matchTemplate(description);
    return Response.json({
      pipeline: instantiatePipeline(t.pipeline, t.pipeline.name),
      source: "template",
      effort,
      note: `Generation failed (${safeApiError(err, "error")}); used the closest template.`,
    });
  }
}
