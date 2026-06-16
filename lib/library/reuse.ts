import type { Pipeline, PipelineNode } from "@/lib/pipeline/schema";

/** Reuse detection (Task 04): the smart part. Scan the user's pipelines for agents whose normalized
 *  role + prompt appear in 2+ pipelines, and suggest promoting them to the Library. Suggestion-only,
 *  never automatic. Bound the scan + cache results in the caller. */

export type ReuseSuggestion = {
  signature: string;
  name: string;
  role: string;
  count: number;
  pipelineNames: string[];
  node: PipelineNode;
};

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** A stable signature for an agent's reusable essence. Returns null when it's too thin to matter. */
function signatureOf(role: string, prompt: string): string | null {
  const r = norm(role);
  const p = norm(prompt);
  if (p.length < 24 && r.length < 4) return null;
  return `${r}::${p.slice(0, 200)}`;
}

export function detectReuse(pipelines: Pipeline[]): ReuseSuggestion[] {
  const map = new Map<string, { node: PipelineNode; role: string; name: string; pipelines: Set<string> }>();

  for (const pipeline of pipelines) {
    const seenInThis = new Set<string>();
    const consider = (node: PipelineNode, role: string, prompt: string, name: string) => {
      const sig = signatureOf(role, prompt);
      if (!sig || seenInThis.has(sig)) return;
      seenInThis.add(sig);
      const entry = map.get(sig) ?? { node, role, name, pipelines: new Set<string>() };
      entry.pipelines.add(pipeline.name);
      map.set(sig, entry);
    };

    for (const n of pipeline.nodes) {
      if (n.team) {
        for (const a of n.team.agents.filter((x) => !x.isController)) {
          const repNode: PipelineNode = {
            ...n,
            id: a.id,
            title: a.name || a.id,
            role: a.role,
            prompt: a.prompt,
            model: a.model,
            team: undefined,
            type: "agent",
          };
          consider(repNode, a.role, a.prompt, a.name || a.id);
        }
      } else if (n.type === "agent" || n.type === "evaluator" || n.type === "transformer") {
        consider(n, n.role, n.prompt, n.title);
      }
    }
  }

  return [...map.entries()]
    .filter(([, v]) => v.pipelines.size >= 2)
    .map(([signature, v]) => ({
      signature,
      name: v.name,
      role: v.role,
      count: v.pipelines.size,
      pipelineNames: [...v.pipelines],
      node: v.node,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
