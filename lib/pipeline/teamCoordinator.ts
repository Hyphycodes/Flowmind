import { TEAM_STRATEGIES, type ControllerKind, type TeamStrategy } from "./schema";

/* ── Team Coordinator (Prompt 03) ─────────────────────────────────────────────
 * Gives a team its identity + internal coordination logic. Runs whenever a team
 * is created or its membership/strategy changes (Architect generation + Crew Room
 * edits). DETERMINISTIC — no LLM — so it stays instant and free even for teams
 * with dozens of agents (a pipeline can hold 50+ agents across its teams).
 *
 * It produces two things and never rewrites a member's prompt:
 *   1. the team's external identity (title + role),
 *   2. the visible controller node(s) the strategy needs (Router / Judge /
 *      Aggregator), plus the internal edges that wire members + controllers.
 *
 * Controllers live inside `team.agents` flagged `isController` + `controllerKind`.
 * Members are the non-controller agents and are portable (usable on their own).
 * Internal edges use the reserved boundary endpoints `input` / `output`. */

const INPUT = "input";
const OUTPUT = "output";

export interface TeamAgentLike {
  id: string;
  name?: string;
  role?: string;
  prompt?: string;
  model?: string;
  isLead?: boolean;
  muted?: boolean;
  isController?: boolean;
  controllerKind?: ControllerKind;
  modelSelection?: unknown;
  toolAttachments?: unknown[];
}

export interface TeamLike {
  strategy?: string;
  agents?: TeamAgentLike[];
  lead?: string;
  internalEdges?: { source: string; target: string }[];
  modelSelection?: unknown;
  toolAttachments?: unknown[];
}

export interface TeamNodeLike {
  id: string;
  title?: string;
  role?: string;
  inputs?: string[];
  outputs?: string[];
  team?: TeamLike;
}

function normalizeStrategy(s: unknown): TeamStrategy {
  return (TEAM_STRATEGIES as readonly string[]).includes(s as string) ? (s as TeamStrategy) : "sequential";
}

/** Strategies that need a single controller, and which kind. */
function controllerKindFor(strategy: TeamStrategy): ControllerKind | null {
  switch (strategy) {
    case "router":
      return "router";
    case "debate":
      return "judge";
    case "parallel":
    case "vote":
    case "council":
      return "aggregator";
    case "sequential":
    case "single":
    default:
      return null;
  }
}

function memberTitle(m: TeamAgentLike): string {
  return m.name || m.role || m.id;
}

function memberIdList(members: TeamAgentLike[]): string {
  return members.map((m) => `${m.id} (${memberTitle(m)})`).join(", ");
}

function memberTitleList(members: TeamAgentLike[]): string {
  return members.map(memberTitle).join(", ");
}

/** Write a controller prompt — second person, referencing the team's real members
 *  and exact inputs/outputs. Members are never invented or rewritten. */
function controllerPrompt(
  kind: ControllerKind,
  strategy: TeamStrategy,
  teamTitle: string,
  members: TeamAgentLike[],
  inputs: string[],
  outputs: string[],
): string {
  const ins = inputs.length ? inputs.join(", ") : "the team's inputs";
  const outs = outputs.length ? outputs.join(", ") : "the team's output";
  const titles = memberTitleList(members);
  switch (kind) {
    case "router":
      return `You are the Router for "${teamTitle}". Read ${ins} and choose exactly one member to handle them — by id — from: ${memberIdList(members)}. Pick the single member best suited to this input. Output the chosen member id and pass the inputs through unchanged; the member you select produces ${outs}.`;
    case "judge":
      return `You are the Judge for "${teamTitle}". The members — ${titles} — argued distinct positions on ${ins}. Weigh their positions on the criteria that matter for this team's job, then decide: produce one resolved result in ${outs}. Do not concatenate the positions — make a decision and justify it in one line.`;
    case "aggregator":
      if (strategy === "vote")
        return `You are the Aggregator for "${teamTitle}". The members — ${titles} — each answered ${ins} independently. Take the majority answer for ${outs}; if there is no clear majority, synthesize the single strongest answer and give a one-line reason for the choice.`;
      return `You are the Aggregator for "${teamTitle}". Combine the outputs of the members — ${titles} — into ${outs}. Map each member's contribution explicitly into the team's outputs; do not simply concatenate them.`;
  }
}

function deriveRole(strategy: TeamStrategy, count: number): string {
  switch (strategy) {
    case "parallel":
      return `${count} agents work in parallel; an aggregator merges their outputs.`;
    case "router":
      return `Routes the input to one of ${count} specialists.`;
    case "debate":
      return `${count} agents debate distinct positions; a judge resolves them.`;
    case "vote":
      return `${count} agents answer independently; the majority answer wins.`;
    case "council":
      return `${count} agents deliberate; an aggregator synthesizes the result.`;
    case "single":
      return `A single focused agent.`;
    case "sequential":
    default:
      return `${count} agents work in sequence, each building on the last.`;
  }
}

function buildController(
  nodeId: string,
  kind: ControllerKind,
  strategy: TeamStrategy,
  teamTitle: string,
  members: TeamAgentLike[],
  inputs: string[],
  outputs: string[],
  model: string,
): TeamAgentLike {
  const name = kind === "router" ? "Router" : kind === "judge" ? "Judge" : "Aggregator";
  return {
    id: `${nodeId}__${kind}`,
    name,
    role: "Team controller",
    prompt: controllerPrompt(kind, strategy, teamTitle, members, inputs, outputs),
    model,
    isController: true,
    controllerKind: kind,
    isLead: false,
    muted: false,
    toolAttachments: [],
  };
}

/** Wire members + controller(s) with the reserved `input`/`output` boundary. */
function buildInternalEdges(
  strategy: TeamStrategy,
  members: TeamAgentLike[],
  controller: TeamAgentLike | null,
): { source: string; target: string }[] {
  const edges: { source: string; target: string }[] = [];
  if (members.length === 0) return edges;

  if (strategy === "sequential" || strategy === "single" || !controller) {
    edges.push({ source: INPUT, target: members[0].id });
    for (let i = 1; i < members.length; i++) edges.push({ source: members[i - 1].id, target: members[i].id });
    edges.push({ source: members[members.length - 1].id, target: OUTPUT });
    return edges;
  }

  if (strategy === "router") {
    // input → Router → each candidate → output; engine runs only the selected member.
    edges.push({ source: INPUT, target: controller.id });
    for (const m of members) {
      edges.push({ source: controller.id, target: m.id });
      edges.push({ source: m.id, target: OUTPUT });
    }
    return edges;
  }

  // parallel / vote / debate / council: input → each member → controller → output
  for (const m of members) {
    edges.push({ source: INPUT, target: m.id });
    edges.push({ source: m.id, target: controller.id });
  }
  edges.push({ source: controller.id, target: OUTPUT });
  return edges;
}

/** Coordinate a team node: rebuild its controller(s), lead, internal edges, and
 *  identity from its members + strategy. Idempotent. Members (non-controllers)
 *  are preserved unchanged except for the recomputed `isLead` flag. The team's
 *  declared `inputs`/`outputs` stay the stable downstream contract. */
export function coordinateTeamNode<T extends TeamNodeLike>(node: T): T {
  if (!node.team) return node;

  const strategy = normalizeStrategy(node.team.strategy);
  const members = (node.team.agents ?? []).filter((a) => !a.isController);

  // Strip any stale lead/controller flags off members; they're recomputed below.
  const cleanMembers: TeamAgentLike[] = members.map((m) => ({
    ...m,
    isController: false,
    controllerKind: undefined,
    isLead: false,
  }));

  if (cleanMembers.length === 0) {
    return { ...node, team: { ...node.team, strategy, agents: [], lead: undefined, internalEdges: [] } };
  }

  const teamTitle = node.title?.trim() || "Team";
  const inputs = (node.inputs ?? []).filter(Boolean);
  const outputs = (node.outputs ?? []).filter(Boolean);
  const model = cleanMembers.find((m) => m.model)?.model || "claude-sonnet-4-6";

  const kind = controllerKindFor(strategy);
  const controller = kind
    ? buildController(node.id, kind, strategy, teamTitle, cleanMembers, inputs, outputs, model)
    : null;

  const agents = controller ? [...cleanMembers, controller] : cleanMembers;

  // Lead / chair: the synthesizing controller (judge/aggregator) when present, else
  // the router, else (sequential) the last member that produces the team's output.
  const lead =
    controller && (controller.controllerKind === "judge" || controller.controllerKind === "aggregator")
      ? controller.id
      : controller?.id ?? cleanMembers[cleanMembers.length - 1].id;

  for (const a of agents) a.isLead = a.id === lead;

  const internalEdges = buildInternalEdges(strategy, cleanMembers, controller);
  const role = node.role?.trim() ? node.role : deriveRole(strategy, cleanMembers.length);

  return {
    ...node,
    role,
    team: { ...node.team, strategy, agents, lead, internalEdges },
  } as T;
}

/** True if an agent is one of the team's controllers. */
export function isControllerAgent(a: TeamAgentLike): boolean {
  return Boolean(a.isController);
}

/** The non-controller members of a team (the portable agents). */
export function teamMembers(team: TeamLike | undefined): TeamAgentLike[] {
  return (team?.agents ?? []).filter((a) => !a.isController);
}

/** The controller agents of a team (0 or 1 today). */
export function teamControllers(team: TeamLike | undefined): TeamAgentLike[] {
  return (team?.agents ?? []).filter((a) => a.isController);
}
