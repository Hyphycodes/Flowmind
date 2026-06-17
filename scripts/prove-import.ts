/**
 * Prompt 21 proof — run the importer on two synthetic repos and report honest accuracy:
 *   A) a hand-rolled raw-SDK app (Anthropic calls wired by variables)
 *   B) a framework app (CrewAI-style crew)
 * Shows detected agents + confidence, inferred flows, teams, and the rendered node count.
 *
 * Run: npx tsx scripts/prove-import.ts
 */
import { importCodebase, type SourceFile } from "../lib/import";

// ── Repo A: hand-rolled raw Anthropic SDK, two agents wired by a variable ──────────────────────
const repoA: SourceFile[] = [
  {
    path: "src/pipeline.ts",
    content: `import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function researcher(query: string) {
  const research = await client.messages.create({
    model: "claude-sonnet-4-6",
    system: "You are a research analyst. Gather the key facts about the query and list sources.",
    messages: [{ role: "user", content: query }],
  });
  return research;
}

export async function writer(research: any) {
  const draft = await client.messages.create({
    model: "claude-opus-4-8",
    system: "You are a writer. Turn the research into a concise executive brief.",
    messages: [{ role: "user", content: research.content }],
  });
  return draft;
}
`,
  },
  { path: "node_modules/junk.js", content: "should be skipped" },
  { path: "README.md", content: "# My app" },
];

// ── Repo B: CrewAI-style framework app (Python) ────────────────────────────────────────────────
const repoB: SourceFile[] = [
  {
    path: "crew.py",
    content: `from crewai import Agent, Task, Crew

researcher = Agent(
    role="Researcher",
    goal="Find credible sources on the topic",
    backstory="A meticulous analyst who never fabricates a citation.",
    llm="claude-sonnet-4-6",
)

scorer = Agent(
    role="Credibility Judge",
    goal="Score each source for credibility",
    backstory="A skeptical evaluator.",
)

writer = Agent(
    role="Writer",
    goal="Write the final brief",
    backstory="A crisp executive writer.",
)

crew = Crew(agents=[researcher, scorer, writer])
`,
  },
];

function report(title: string, files: SourceFile[]) {
  const { ir, report, pipeline } = importCodebase(files, title);
  console.log(`\n══════════ ${title} ══════════`);
  console.log(`verdict: ${report.verdict} — ${report.summary}`);
  for (const a of ir.agents) {
    console.log(`  • [${a.status}] ${a.name.padEnd(24)} kind=${a.kind} model=${a.model ?? "?"} conf=${a.confidence}  (${a.framework})`);
    if (a.prompt) console.log(`      prompt: "${a.prompt.slice(0, 60)}${a.prompt.length > 60 ? "…" : ""}"`);
  }
  console.log(`  flows: ${ir.flows.map((f) => `${f.from.split("_").pop()}→${f.to.split("_").pop()} (${f.confidence})`).join(", ") || "none"}`);
  console.log(`  teams: ${ir.teams.map((t) => `${t.name}[${t.strategy}, ${t.memberIds.length}]`).join(", ") || "none"}`);
  console.log(`  → rendered pipeline: ${pipeline ? `${pipeline.nodes.length} nodes, ${pipeline.edges.length} edges` : "none"}`);
  console.log(`  notes: ${ir.notes.length}`);
}

report("Hand-rolled Anthropic app", repoA);
report("CrewAI framework app", repoB);
console.log("");
