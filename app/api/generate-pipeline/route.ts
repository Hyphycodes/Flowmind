import { hasAnthropicKey } from "@/lib/ai/anthropic";
import { generateArchitectPipeline } from "@/lib/pipeline/architect";
import { isEffort, type EffortLevel } from "@/lib/pipeline/effort";
import { instantiatePipeline, matchTemplate } from "@/lib/pipeline/fixtures";
import { detectAmbiguity } from "@/lib/preferences/clarify";
import { builderPreferencesSchema, preferencesToPromptBlock } from "@/lib/preferences/schema";
import { safeApiError, requireAuthedAI } from "@/lib/api/guards";
import { getBillingAccount, recordEditSpend } from "@/lib/billing/usage";
import { canEditPipeline } from "@/lib/billing/featureGates";

export const runtime = "nodejs";
export const maxDuration = 120;

// Requires auth + per-user rate limiting: this route spends provider tokens (real Claude
// generation), so anonymous access would expose the API key to abuse.
export async function POST(req: Request) {
  const guard = await requireAuthedAI();
  if (guard instanceof Response) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = (body ?? {}) as { description?: unknown; effort?: unknown; clarified?: unknown; preferences?: unknown };
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const effort: EffortLevel = isEffort(raw.effort) ? raw.effort : "balanced";
  if (!description) {
    return Response.json(
      { error: "Describe the AI system you want to build." },
      { status: 400 },
    );
  }

  // Ask-or-build: one sharp question only when genuinely ambiguous, and never on a re-submit.
  if (raw.clarified !== true) {
    const amb = detectAmbiguity(description);
    if (amb.ambiguous) {
      return Response.json({ needsClarification: true, question: amb.question, options: amb.options });
    }
  }

  // Builder preferences → soft guidance injected into the system prompt (nudges, never overrides).
  const prefs = builderPreferencesSchema.safeParse(raw.preferences);
  const guidance = prefs.success ? preferencesToPromptBlock(prefs.data) : null;

  if (!hasAnthropicKey()) {
    // Template fallback makes no AI call — it never consumes an edit.
    const t = matchTemplate(description);
    return Response.json({
      pipeline: instantiatePipeline(t.pipeline, t.pipeline.name),
      source: "template",
      effort,
      note: "Used a built-in template — set ANTHROPIC_API_KEY for custom AI generation.",
    });
  }

  // From-scratch generation is an AI design call → metered against the EDITS pool (Prompt 20).
  const account = await getBillingAccount();
  const gate = canEditPipeline(account, "generate");
  if (!gate.allowed) {
    return Response.json({ error: gate.reason ?? "Out of generations", gate, pool: "edits" }, { status: 402 });
  }

  try {
    const pipeline = await generateArchitectPipeline(description, effort, guidance ?? undefined);
    await recordEditSpend(); // success only — a failed generation (catch below) consumes nothing
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
