import { generateObject } from "ai";
import { z } from "zod";
import { anthropicModel, hasAnthropicKey } from "@/lib/ai/anthropic";
import { loadPrompt } from "@/lib/prompts";
import { safeApiError } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 60;

const resultSchema = z.object({
  summary: z.string(),
  flags: z
    .array(
      z.object({
        nodeId: z.string(),
        severity: z.enum(["info", "warning", "error"]).default("info"),
        message: z.string(),
      }),
    )
    .default([]),
});

function trunc(value: unknown, max = 600): unknown {
  if (typeof value === "string") return value.length > max ? `${value.slice(0, max)}…` : value;
  if (value == null) return value;
  const json = JSON.stringify(value);
  if (json.length <= max) return value;
  return `${json.slice(0, max)}…`;
}

type LooseStep = {
  nodeId?: string;
  title?: string;
  status?: string;
  durationMs?: number;
  costUsd?: number;
  model?: string;
  summary?: string;
  input?: unknown;
  output?: unknown;
};
type LooseAgent = {
  teamNodeId?: string;
  agentName?: string;
  status?: string;
  model?: string;
  costUsd?: number;
  latencyMs?: number;
  outputSummary?: string;
};

/** Reduce a full RunTrace to just what the explainer needs, with payloads truncated so the
 *  request stays small. Focuses on one node when scope = "node". */
function compactTrace(trace: unknown, scope: "node" | "run", focusId?: string) {
  const t = (trace ?? {}) as { steps?: LooseStep[]; agentRuns?: LooseAgent[]; costUsd?: number; status?: string };
  let steps = Array.isArray(t.steps) ? t.steps : [];
  let agentRuns = Array.isArray(t.agentRuns) ? t.agentRuns : [];
  if (scope === "node" && focusId) {
    steps = steps.filter((s) => s.nodeId === focusId);
    agentRuns = agentRuns.filter((a) => a.teamNodeId === focusId);
  }
  return {
    status: t.status,
    costUsd: t.costUsd,
    steps: steps.slice(0, 40).map((s) => ({
      nodeId: s.nodeId,
      title: s.title,
      status: s.status,
      durationMs: s.durationMs,
      costUsd: s.costUsd,
      model: s.model,
      summary: s.summary,
      input: trunc(s.input),
      output: trunc(s.output),
    })),
    agents: agentRuns.slice(0, 40).map((a) => ({
      teamNodeId: a.teamNodeId,
      agentName: a.agentName,
      status: a.status,
      model: a.model,
      costUsd: a.costUsd,
      latencyMs: a.latencyMs,
      outputSummary: trunc(a.outputSummary, 300),
    })),
  };
}

export async function POST(req: Request) {
  if (!hasAnthropicKey()) {
    return Response.json({ error: "AI key required to explain a run." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as { scope?: unknown; focusId?: unknown; trace?: unknown };
  const scope: "node" | "run" = b.scope === "node" ? "node" : "run";
  const focusId = typeof b.focusId === "string" ? b.focusId : undefined;
  if (!b.trace || typeof b.trace !== "object") {
    return Response.json({ error: "Missing run trace." }, { status: 400 });
  }

  const prompt = (() => {
    try {
      return loadPrompt("07-trace-explainer");
    } catch {
      return null;
    }
  })();
  if (!prompt) return Response.json({ error: "Explainer unavailable." }, { status: 500 });

  try {
    const { object } = await generateObject({
      model: anthropicModel(),
      schema: resultSchema,
      system: prompt,
      prompt: JSON.stringify({ scope, focusId, trace: compactTrace(b.trace, scope, focusId) }),
      temperature: 0.3,
      maxRetries: 1,
    });
    return Response.json(object);
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Could not explain this run.") }, { status: 500 });
  }
}
