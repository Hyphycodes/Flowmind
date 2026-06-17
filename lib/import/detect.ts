import type { ImportFramework, ImportIR, ImportReport, ImportedAgent, ImportedFlow, ImportedTeam } from "./ir";

/**
 * Static analyzer (Prompt 21). Pure, dependency-free, server-side. Given a set of source files it
 * detects LLM call sites (agents), their prompts + models, and the data flow between them — each
 * confidence-tagged. It never fabricates a confident label: a weak signal becomes an `unknown` node.
 *
 * This is heuristic line/regex analysis (not a full multi-language AST) — chosen so it degrades
 * gracefully across JS/TS/Python and hand-rolled code, and never throws on malformed input.
 */

export type SourceFile = { path: string; content: string };

const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|md|txt)$/i;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|venv|\.venv|__pycache__|coverage|vendor)(\/|$)/;
const MAX_FILE_BYTES = 200_000;
const MAX_FILES = 400;

// Framework + LLM-call signatures. Each tuple: [regex, framework, kind, baseConfidence, evidenceLabel].
const CALL_SIGNATURES: Array<[RegExp, ImportFramework, "agent" | "tool" | "evaluator", number, string]> = [
  [/\.messages\.create\s*\(/, "anthropic", "agent", 0.9, "Anthropic messages.create()"],
  [/anthropic\.completions\.create\s*\(/, "anthropic", "agent", 0.85, "Anthropic completions.create()"],
  [/\.chat\.completions\.create\s*\(/, "openai", "agent", 0.9, "OpenAI chat.completions.create()"],
  [/\bopenai\.responses\.create\s*\(/, "openai", "agent", 0.85, "OpenAI responses.create()"],
  [/\b(generateText|generateObject|streamText|streamObject)\s*\(/, "vercel_ai", "agent", 0.88, "Vercel AI SDK call"],
  [/\bnew\s+(ChatAnthropic|ChatOpenAI)\s*\(/, "langchain", "agent", 0.8, "LangChain chat model"],
  [/\b(LLMChain|ConversationChain|create_react_agent|AgentExecutor)\s*\(/, "langchain", "agent", 0.78, "LangChain chain/agent"],
  [/\bChat(Anthropic|OpenAI)\s*\(/, "langchain", "agent", 0.78, "LangChain chat model (py)"],
  [/\bAgent\s*\(/, "crewai", "agent", 0.7, "CrewAI/agent constructor"],
  [/\bTask\s*\(/, "crewai", "agent", 0.55, "CrewAI Task"],
];

const MODEL_PATTERNS = [
  /model\s*[:=]\s*["'`]([\w.\-:/]+)["'`]/,
  /["'`](claude-[\w.\-]+|gpt-[\w.\-]+|o[134][\w.\-]*|gemini-[\w.\-]+|llama[\w.\-]*|mistral[\w.\-]*)["'`]/i,
];

const TEAM_SIGNATURES: Array<[RegExp, ImportedTeam["strategy"], number, string]> = [
  [/\bCrew\s*\(/, "sequential", 0.7, "CrewAI Crew()"],
  [/\bPromise\.all\s*\(/, "parallel", 0.55, "Promise.all (parallel fan-out)"],
  [/\basyncio\.gather\s*\(/, "parallel", 0.55, "asyncio.gather (parallel fan-out)"],
  [/\bStateGraph\s*\(|\blanggraph\b/, "router", 0.5, "LangGraph state machine"],
];

function isCode(path: string): boolean {
  return CODE_EXT.test(path);
}

function slug(s: string, fallback: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

/** Name the agent, preferring the most LOCAL signal so labels don't bleed across blocks:
 *  (1) the variable/function it's assigned to on the call line, (2) a role/name field inside the
 *  constructor body just below, (3) the enclosing function/class above. */
function nearestName(lines: string[], idx: number): string | undefined {
  // (1) same-line (or one above) assignment: `researcher = Agent(`, `const x = await …`.
  for (let i = idx; i >= Math.max(0, idx - 1); i--) {
    const m =
      lines[i].match(/(?:const|let|var)\s+([A-Za-z_]\w*)\s*=/) ||
      lines[i].match(/^\s*([A-Za-z_]\w*)\s*=\s*[A-Za-z_]/);
    if (m) return m[1];
  }
  // (2) role/name/title inside the constructor body (next few lines).
  for (let i = idx; i <= Math.min(lines.length - 1, idx + 6); i++) {
    const m = lines[i].match(/\b(?:role|name|title)\s*[:=]\s*["'`]([^"'`]{2,})["'`]/);
    if (m) return m[1];
  }
  // (3) enclosing function/def/class above.
  for (let i = idx; i >= 0 && i > idx - 30; i--) {
    const m = lines[i].match(/(?:function|def|class)\s+([A-Za-z_]\w*)/);
    if (m) return m[1];
  }
  return undefined;
}

const PROMPT_FIELD =
  /\b(system|system_prompt|systemPrompt|SYSTEM_PROMPT|instructions|backstory|goal|persona)\s*[:=]\s*["'`]([^"'`]{12,})["'`]/;

/** Find the CLOSEST prompt string to a call site (tight window, nearest by distance) so a later
 *  call never inherits an earlier agent's prompt. No file-wide fallback — that leaks. */
function nearestPrompt(_content: string, lines: string[], idx: number): string | undefined {
  let best: { dist: number; text: string } | null = null;
  for (let i = Math.max(0, idx - 3); i <= Math.min(lines.length - 1, idx + 12); i++) {
    const m = lines[i].match(PROMPT_FIELD);
    if (m) {
      const dist = Math.abs(i - idx);
      if (!best || dist < best.dist) best = { dist, text: m[2].trim() };
    }
  }
  if (best) return best.text;
  // role:"system" + content:"…" message object, very close to the call.
  const window = lines.slice(Math.max(0, idx - 2), idx + 14).join("\n");
  const roleMatch = window.match(/role\s*[:=]\s*["'`]system["'`][\s\S]{0,80}?content\s*[:=]\s*["'`]([^"'`]{12,})["'`]/);
  return roleMatch ? roleMatch[1].trim() : undefined;
}

function findModel(lines: string[], idx: number): string | undefined {
  for (let i = Math.max(0, idx - 6); i <= Math.min(lines.length - 1, idx + 10); i++) {
    for (const re of MODEL_PATTERNS) {
      const m = lines[i].match(re);
      if (m) return m[1];
    }
  }
  return undefined;
}

/** Detect agents in one file. */
function detectInFile(file: SourceFile): ImportedAgent[] {
  const lines = file.content.split("\n");
  const agents: ImportedAgent[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(\/\/|#|\*)/.test(line)) continue; // skip comment lines
    for (const [re, framework, kind, base, label] of CALL_SIGNATURES) {
      if (!re.test(line)) continue;
      if (seen.has(i)) continue;
      seen.add(i);
      const name = nearestName(lines, i);
      const prompt = nearestPrompt(file.content, lines, i);
      const model = findModel(lines, i);
      // Confidence: start at the signature base, reward a prompt + model, penalize anonymity.
      let confidence = base;
      if (prompt) confidence += 0.06;
      if (model) confidence += 0.05;
      if (!name) confidence -= 0.12;
      confidence = Math.max(0.2, Math.min(0.98, confidence));
      const status = confidence >= 0.55 ? "detected" : "unknown";
      // An evaluator if the name screams judgement.
      const resolvedKind: ImportedAgent["kind"] =
        kind === "agent" && /\b(judge|scor|eval|critic|grade|verif|check)/i.test(name ?? "") ? "evaluator" : kind;
      agents.push({
        id: `${slug(file.path.split("/").pop() ?? "f", "f")}_${i}_${slug(name ?? "agent", "agent")}`.slice(0, 60),
        name: name ? humanize(name) : `Unnamed ${framework} call`,
        role: name ? undefined : "unlabeled call site",
        model,
        prompt,
        framework,
        kind: resolvedKind,
        confidence: Number(confidence.toFixed(2)),
        status,
        sourceRef: { file: file.path, line: i + 1 },
        evidence: `${label} at ${file.path}:${i + 1}`,
      });
      break; // one detection per line
    }
  }
  return agents;
}

function humanize(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Infer data flow within a file: an LLM-result variable later passed into another call. */
function inferFlows(file: SourceFile, agents: ImportedAgent[]): ImportedFlow[] {
  const inFile = agents.filter((a) => a.sourceRef.file === file.path).sort((a, b) => a.sourceRef.line - b.sourceRef.line);
  if (inFile.length < 2) return [];
  const lines = file.content.split("\n");
  const flows: ImportedFlow[] = [];

  // Map each agent line → the variable it assigns (const x = await ...create()).
  const assignVar = new Map<string, string>(); // agentId → varName
  for (const a of inFile) {
    const l = lines[a.sourceRef.line - 1] ?? "";
    const m = l.match(/(?:const|let|var)\s+([A-Za-z_]\w*)\s*=/) || l.match(/^\s*([A-Za-z_]\w*)\s*=/);
    if (m) assignVar.set(a.id, m[1]);
  }

  // For each later agent, if an earlier agent's var appears between them, that's a handoff.
  for (let j = 1; j < inFile.length; j++) {
    const later = inFile[j];
    const span = lines.slice(inFile[j - 1].sourceRef.line - 1, later.sourceRef.line + 6).join("\n");
    let wired = false;
    for (let k = 0; k < j; k++) {
      const earlier = inFile[k];
      const v = assignVar.get(earlier.id);
      if (v && new RegExp(`\\b${v}\\b`).test(span)) {
        flows.push({ from: earlier.id, to: later.id, confidence: 0.75, via: `variable \`${v}\` reused` });
        wired = true;
      }
    }
    if (!wired) {
      // Fall back to sequential order (lower confidence) so the graph still connects.
      flows.push({ from: inFile[j - 1].id, to: later.id, confidence: 0.45, via: "sequential order" });
    }
  }
  return flows;
}

function detectTeams(file: SourceFile, agents: ImportedAgent[]): ImportedTeam[] {
  const teams: ImportedTeam[] = [];
  const inFile = agents.filter((a) => a.sourceRef.file === file.path);
  if (inFile.length < 2) return [];
  for (const [re, strategy, conf, label] of TEAM_SIGNATURES) {
    if (re.test(file.content)) {
      teams.push({
        id: `team_${slug(file.path.split("/").pop() ?? "f", "f")}_${strategy}`,
        name: `${humanize(strategy)} crew`,
        strategy,
        memberIds: inFile.map((a) => a.id),
        confidence: conf,
        evidence: `${label} in ${file.path}`,
      });
      break; // one team signal per file
    }
  }
  return teams;
}

/** Analyze a whole repo/folder into the IR + an honest report. */
export function analyzeFiles(files: SourceFile[]): { ir: ImportIR; report: ImportReport } {
  const scannedFiles: string[] = [];
  const skipped: ImportIR["skipped"] = [];
  let allAgents: ImportedAgent[] = [];
  let allFlows: ImportedFlow[] = [];
  let allTeams: ImportedTeam[] = [];

  const candidates = files
    .filter((f) => {
      if (SKIP_DIR.test(f.path)) {
        skipped.push({ file: f.path, reason: "vendor/build directory" });
        return false;
      }
      if (!SCAN_EXT.test(f.path)) {
        skipped.push({ file: f.path, reason: "unsupported file type" });
        return false;
      }
      if ((f.content?.length ?? 0) > MAX_FILE_BYTES) {
        skipped.push({ file: f.path, reason: "file too large" });
        return false;
      }
      return true;
    })
    .slice(0, MAX_FILES);

  for (const f of candidates) {
    scannedFiles.push(f.path);
    if (!isCode(f.path)) continue; // .md/.txt are scanned for prompt context but yield no agents directly
    const agents = detectInFile(f);
    allAgents = allAgents.concat(agents);
    allFlows = allFlows.concat(inferFlows(f, agents));
    allTeams = allTeams.concat(detectTeams(f, agents));
  }

  // De-dupe ids.
  const idSeen = new Set<string>();
  allAgents = allAgents.map((a) => {
    let id = a.id;
    while (idSeen.has(id)) id = `${id}_x`;
    idSeen.add(id);
    return { ...a, id };
  });

  const frameworks = [...new Set(allAgents.map((a) => a.framework))];
  const detected = allAgents.filter((a) => a.status === "detected").length;
  const unknown = allAgents.length - detected;

  const notes: string[] = [];
  if (allAgents.length === 0) notes.push("No LLM call sites detected — this may not be an AI codebase, or it uses a framework/pattern the static analyzer doesn't cover yet.");
  if (unknown > 0) notes.push(`${unknown} call site(s) were low-confidence and are marked "needs review".`);
  if (allFlows.some((f) => f.via === "sequential order")) notes.push("Some data-flow edges were inferred from code order, not a traced variable — verify them.");
  notes.push("Cross-file data flow, registry/DI indirection, and runtime-assembled prompts are not fully resolved in this pass.");

  const ir: ImportIR = {
    agents: allAgents,
    flows: allFlows,
    teams: allTeams,
    scannedFiles,
    skipped,
    frameworks,
    notes,
  };

  const verdict: ImportReport["verdict"] = detected >= 2 ? "ai_system" : detected >= 1 ? "partial" : "none";
  const report: ImportReport = {
    detectedAgents: detected,
    unknownAgents: unknown,
    flows: allFlows.length,
    teams: allTeams.length,
    frameworks,
    scanned: scannedFiles.length,
    skipped: skipped.length,
    verdict,
    summary:
      verdict === "none"
        ? `Scanned ${scannedFiles.length} files but found no clear AI system. ${notes[0]}`
        : `Found ${detected} agent${detected === 1 ? "" : "s"}${unknown ? ` (+${unknown} to review)` : ""}, ${allFlows.length} data flow${allFlows.length === 1 ? "" : "s"}, and ${allTeams.length} team${allTeams.length === 1 ? "" : "s"} across ${scannedFiles.length} files using ${frameworks.filter((f) => f !== "unknown").join(", ") || "raw SDK calls"}.`,
  };

  return { ir, report };
}
