/**
 * Prompt 17 proof — run the SAME model-shaped output through the effort clamp at each level and
 * print the resulting structure (node types, model per node, team strategy + members). Demonstrates
 * that Tight / Balanced / Deep are structurally different, not just verbose.
 *
 * Run: npx tsx scripts/prove-effort-levels.ts
 *
 * The input object mimics what the generation model returns for:
 *   "monitor competitor product launches and summarize weekly"
 * — i.e. a rich, team-shaped design. The clamp is what makes each level honor its contract.
 */
import { architectToCandidate } from "../lib/pipeline/architect";
import { EFFORT_LEVELS } from "../lib/pipeline/effort";

// A deliberately team-heavy, Opus-using design (as a DEEP model might emit it).
const modelOutput = {
  name: "Competitor Launch Monitor",
  summary: "Monitors competitor product launches and writes a weekly brief.",
  nodes: [
    { id: "brief", kind: "input", title: "Brief", outputs: ["query"], fields: [{ name: "query", label: "What to monitor", type: "text" }] },
    {
      id: "source_team",
      kind: "team",
      title: "Source Team",
      strategy: "parallel",
      inputs: ["query"],
      outputs: ["signals"],
      members: [
        { id: "news_watch", kind: "agent", title: "News Watcher", prompt: "Collect launch news." },
        { id: "social_watch", kind: "agent", title: "Social Watcher", prompt: "Collect social signals." },
      ],
    },
    {
      id: "analysis_team",
      kind: "team",
      title: "Analysis Team",
      strategy: "debate",
      inputs: ["signals"],
      outputs: ["analysis"],
      members: [
        { id: "bull", kind: "agent", title: "Bull Case", prompt: "Argue the launch matters." },
        { id: "bear", kind: "agent", title: "Bear Case", prompt: "Argue the launch is noise." },
        { id: "moderator", kind: "agent", title: "Moderator", prompt: "Frame the debate." },
        { id: "judge", kind: "evaluator", title: "Judge", prompt: "Decide which case wins." },
      ],
    },
    { id: "scorer", kind: "evaluator", title: "Impact Scorer", prompt: "Score competitive impact 0-100.", inputs: ["analysis"], outputs: ["impact"] },
    { id: "brief_out", kind: "output", title: "Weekly Brief", inputs: ["impact"], outputs: ["weekly_brief"], display: [{ label: "Weekly Brief", from: "weekly_brief" }] },
  ],
  edges: [
    { from: "brief", to: "source_team", dataKey: "query" },
    { from: "source_team", to: "analysis_team", dataKey: "signals" },
    { from: "analysis_team", to: "scorer", dataKey: "analysis" },
    { from: "scorer", to: "brief_out", dataKey: "impact" },
  ],
};

function summarize(level: (typeof EFFORT_LEVELS)[number]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate = architectToCandidate(modelOutput as any, level);
  console.log(`\n══════════ ${level.toUpperCase()} ══════════`);
  let teams = 0;
  const strategies = new Set<string>();
  for (const n of candidate.nodes as Array<Record<string, unknown>>) {
    const team = n.team as { strategy?: string; agents?: Array<Record<string, unknown>> } | undefined;
    if (team) {
      teams++;
      strategies.add(team.strategy ?? "");
      const members = (team.agents ?? []).filter((a) => !a.isController);
      const models = [...new Set((team.agents ?? []).map((a) => String(a.model)))].join(", ");
      console.log(`  ⬢ TEAM  ${String(n.title).padEnd(20)} strategy=${team.strategy}  members=${members.length}  models=[${models}]`);
    } else {
      console.log(`  • ${String(n.type).padEnd(11)} ${String(n.title).padEnd(20)} model=${n.model}`);
    }
  }
  console.log(`  → teams=${teams}  strategies={${[...strategies].join(",")}}  totalNodes=${(candidate.nodes as unknown[]).length}`);
}

console.log("INPUT: \"monitor competitor product launches and summarize weekly\" (same model output, three contracts)");
for (const level of EFFORT_LEVELS) summarize(level);
console.log("");
