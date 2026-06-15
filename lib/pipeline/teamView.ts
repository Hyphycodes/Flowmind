import type { AgentConfig, Pipeline, Team } from "./schema";

/* ── Team view stack ──────────────────────────────────────────────────────────
 * Double-clicking a team zooms the canvas into its internal graph. The active
 * level is described by `teamPath` (ids of entered teams). These pure helpers
 * resolve the active team from a path and lay out its agents left-to-right. */

export interface TeamCrumb {
  id: string;
  label: string;
}

export interface TeamView {
  /** how many levels deep (0 = top-level pipeline) */
  level: number;
  /** the active (deepest) team, or null at the top level */
  team: Team | null;
  /** breadcrumb entries for each entered level */
  crumbs: TeamCrumb[];
}

type MaybeTeam = { team?: Team };

/** Resolve the active team + breadcrumb from a teamPath. Agents are flat today
 *  (an AgentConfig has no `team`), so paths deeper than one level only resolve if
 *  a member ever carries its own team — the walk is written to support that. */
export function resolveTeamView(pipeline: Pipeline | null, teamPath: string[]): TeamView {
  const crumbs: TeamCrumb[] = [];
  if (!pipeline || teamPath.length === 0) return { level: 0, team: null, crumbs };

  const top = pipeline.nodes.find((n) => n.id === teamPath[0]);
  if (!top?.team) return { level: 0, team: null, crumbs };

  let team: Team = top.team;
  crumbs.push({ id: top.id, label: top.title });

  for (let i = 1; i < teamPath.length; i++) {
    const agent = team.agents.find((a) => a.id === teamPath[i]) as (AgentConfig & MaybeTeam) | undefined;
    if (!agent?.team) break;
    team = agent.team;
    crumbs.push({ id: agent.id, label: agent.name || agent.id });
  }

  return { level: crumbs.length, team, crumbs };
}

/** Does the entity with `id` at the current level have a team to enter? */
export function canEnterTeam(pipeline: Pipeline | null, teamPath: string[], id: string): boolean {
  if (!pipeline) return false;
  if (teamPath.length === 0) return Boolean(pipeline.nodes.find((n) => n.id === id)?.team);
  const view = resolveTeamView(pipeline, teamPath);
  const agent = view.team?.agents.find((a) => a.id === id) as (AgentConfig & MaybeTeam) | undefined;
  return Boolean(agent?.team);
}

const COL_GAP = 280;
const ROW_GAP = 150;
const X0 = 80;
const Y0 = 260;

/** Left-to-right layered layout for a team's agents, derived from `internalEdges`
 *  (which use the reserved `input`/`output` boundary endpoints). Falls back to a
 *  single left-to-right row when there are no usable edges. Persisted `position`
 *  on an agent wins, so drags inside a team stick. */
export function layoutAgents(
  agents: AgentConfig[],
  internalEdges: { source: string; target: string }[],
): Record<string, { x: number; y: number }> {
  const ids = agents.map((a) => a.id);
  const idSet = new Set(ids);
  const ROOT = "__input__";

  const adj = new Map<string, string[]>([[ROOT, []]]);
  const indeg = new Map<string, number>([[ROOT, 0]]);
  for (const id of ids) {
    adj.set(id, []);
    indeg.set(id, 0);
  }

  let usable = 0;
  for (const e of internalEdges ?? []) {
    const s = e.source === "input" ? ROOT : idSet.has(e.source) ? e.source : null;
    const t = e.target === "output" ? null : idSet.has(e.target) ? e.target : null;
    if (!s || !t || s === t) continue;
    adj.get(s)!.push(t);
    indeg.set(t, (indeg.get(t) ?? 0) + 1);
    usable++;
  }

  const pos: Record<string, { x: number; y: number }> = {};

  // Fallback: no usable edges → a single left-to-right row in array order.
  if (usable === 0) {
    agents.forEach((a, i) => {
      pos[a.id] = a.position ?? { x: X0 + i * COL_GAP, y: Y0 };
    });
    return pos;
  }

  // Connect orphan agents (no incoming) to the root so they layer at column 0.
  for (const id of ids) if ((indeg.get(id) ?? 0) === 0) adj.get(ROOT)!.push(id);

  // Longest-path layering via Kahn topological order.
  const order: string[] = [];
  const indegCopy = new Map<string, number>();
  for (const id of ids) indegCopy.set(id, adj.get(ROOT)!.includes(id) ? 1 : indeg.get(id) ?? 0);
  indegCopy.set(ROOT, 0);
  const queue = [ROOT];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      indegCopy.set(v, (indegCopy.get(v) ?? 0) - 1);
      if ((indegCopy.get(v) ?? 0) <= 0 && !order.includes(v) && !queue.includes(v)) queue.push(v);
    }
  }
  for (const id of ids) if (!order.includes(id)) order.push(id); // any cycle leftovers

  const layer = new Map<string, number>([[ROOT, 0]]);
  for (const u of order) {
    const lu = layer.get(u) ?? 0;
    for (const v of adj.get(u) ?? []) layer.set(v, Math.max(layer.get(v) ?? 0, lu + 1));
  }

  const byCol = new Map<number, string[]>();
  for (const id of ids) {
    const col = Math.max(0, (layer.get(id) ?? 1) - 1);
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col)!.push(id);
  }

  for (const [col, colIds] of byCol) {
    const count = colIds.length;
    colIds.forEach((id, i) => {
      const agent = agents.find((a) => a.id === id);
      pos[id] = agent?.position ?? { x: X0 + col * COL_GAP, y: Y0 + (i - (count - 1) / 2) * ROW_GAP };
    });
  }
  return pos;
}
