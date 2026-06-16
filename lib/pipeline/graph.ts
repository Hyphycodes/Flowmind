import type { Pipeline } from "./schema";

/** A node + every node reachable downstream of it via edges. The set used by replay-from-here:
 *  re-run this node and its descendants, seeding upstream outputs from the last run. Dependency-free
 *  so both the client store and the server run route can share it. */
export function descendantsOf(p: Pipeline, fromId: string): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of p.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const set = new Set<string>([fromId]);
  const stack = [fromId];
  while (stack.length) {
    const u = stack.pop()!;
    for (const v of adj.get(u) ?? []) {
      if (!set.has(v)) {
        set.add(v);
        stack.push(v);
      }
    }
  }
  return set;
}
