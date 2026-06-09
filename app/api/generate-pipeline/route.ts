import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { generatePipeline } from "@/lib/pipeline/generatePipeline";
import { instantiatePipeline, matchTemplate } from "@/lib/pipeline/fixtures";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const description =
    typeof (body as any)?.description === "string" ? (body as any).description.trim() : "";
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
      note: "Used a built-in template — set ANTHROPIC_API_KEY for custom AI generation.",
    });
  }

  try {
    const pipeline = await generatePipeline(description);
    return Response.json({ pipeline, source: "ai" });
  } catch (err) {
    const t = matchTemplate(description);
    return Response.json({
      pipeline: instantiatePipeline(t.pipeline, t.pipeline.name),
      source: "template",
      note: `Generation failed (${(err as Error)?.message ?? "error"}); used the closest template.`,
    });
  }
}
