import type { OutputTable, Pipeline } from "@/lib/pipeline/schema";

/**
 * Developer bundle generator (Prompt 22) — a self-contained, runnable package.
 *
 * The old export dumped ~40 files of internal representation. This emits a small, clean package a
 * developer can drop into their repo and run: ONE entry point (`agents/index.js` → `runPipeline`),
 * a `package.json`, a README with exact drop-in + one-line usage, and a portable engine. It runs in
 * a clean environment with **no install and no key** (deterministic simulate mode for a smoke test),
 * and makes real Claude calls once `@anthropic-ai/sdk` is installed and `ANTHROPIC_API_KEY` is set.
 * No Flowmind internals, no secrets — the user supplies their own key via env.
 */

export type BundleFile = { path: string; content: string; description?: string };

/** A trimmed, runnable spec of the pipeline (no run cruft, no internal infra). */
function runnableSpec(p: Pipeline, tables: OutputTable[]) {
  return {
    name: p.name,
    description: p.description,
    input: {
      fields: p.mockInputs.map((f) => ({ key: f.key, label: f.label, example: f.value || "" })),
    },
    nodes: p.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      role: n.role || undefined,
      prompt: n.prompt || undefined,
      model: n.model,
      inputs: n.inputs,
      outputs: n.outputs,
      team: n.team
        ? {
            strategy: n.team.strategy,
            agents: n.team.agents
              .filter((a) => !a.isController)
              .map((a) => ({ id: a.id, name: a.name, role: a.role || undefined, prompt: a.prompt || "", model: a.model })),
          }
        : undefined,
    })),
    edges: p.edges.map((e) => ({ source: e.source, target: e.target, dataKey: e.dataKey || undefined })),
    output: {
      tables: tables.map((t) => ({ id: t.id, name: t.name, columns: t.columns.map((c) => c.key) })),
    },
  };
}

const ENGINE_JS = `// Portable runtime — pure ESM, zero build step. Runs in simulate mode with no key/deps;
// makes real Claude calls when ANTHROPIC_API_KEY is set and @anthropic-ai/sdk is installed.

function topoSort(spec) {
  const inDeg = new Map(spec.nodes.map((n) => [n.id, 0]));
  const adj = new Map(spec.nodes.map((n) => [n.id, []]));
  for (const e of spec.edges) {
    if (!adj.has(e.source) || !inDeg.has(e.target)) continue;
    adj.get(e.source).push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  }
  const queue = spec.nodes.filter((n) => (inDeg.get(n.id) || 0) === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const v of adj.get(id) || []) {
      inDeg.set(v, inDeg.get(v) - 1);
      if (inDeg.get(v) === 0) queue.push(v);
    }
  }
  // Append any nodes not reached (defensive — keeps the run total).
  for (const n of spec.nodes) if (!order.includes(n.id)) order.push(n.id);
  return order.map((id) => spec.nodes.find((n) => n.id === id));
}

function truncate(s, n = 240) {
  s = typeof s === "string" ? s : JSON.stringify(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function callModel(system, user, model) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Deterministic simulate output — lets the package run with zero setup for a smoke test.
    return "‹simulated " + model + "› " + truncate(system, 80) + " :: " + truncate(user, 120);
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    system: system || "You are a helpful agent in a pipeline.",
    messages: [{ role: "user", content: typeof user === "string" ? user : JSON.stringify(user) }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function runTeam(node, inputData) {
  const agents = (node.team && node.team.agents) || [];
  const strategy = (node.team && node.team.strategy) || "sequential";
  if (strategy === "sequential") {
    let carry = inputData;
    const steps = [];
    for (const a of agents) {
      const out = await callModel(a.prompt || a.name, carry, a.model);
      steps.push({ agent: a.name, output: out });
      carry = out;
    }
    return { strategy, result: carry, steps };
  }
  // parallel / vote / debate / router / single → run members on the same input, combine.
  const steps = [];
  for (const a of agents) steps.push({ agent: a.name, output: await callModel(a.prompt || a.name, inputData, a.model) });
  return { strategy, result: steps.map((s) => s.agent + ": " + truncate(s.output, 200)).join("\\n"), steps };
}

export async function runEngine(spec, input = {}) {
  const ctx = {}; // dataKey -> value
  for (const f of (spec.input && spec.input.fields) || []) ctx[f.key] = input[f.key] != null ? input[f.key] : f.example || "";
  const outputs = {};

  for (const node of topoSort(spec)) {
    if (node.type === "input") {
      for (const o of node.outputs || []) ctx[o] = ctx[o] != null ? ctx[o] : input;
      outputs[node.id] = input;
      continue;
    }
    const inputData = {};
    for (const k of node.inputs || []) inputData[k] = ctx[k];
    const payload = Object.keys(inputData).length ? inputData : input;

    let result;
    if (node.team && node.team.agents && node.team.agents.length) {
      result = await runTeam(node, JSON.stringify(payload));
      result = result.result;
    } else if (node.type === "transformer") {
      result = payload; // reshape steps are pass-throughs in the portable runtime
    } else {
      result = await callModel(node.prompt || node.title, JSON.stringify(payload), node.model);
    }
    for (const o of node.outputs || []) ctx[o] = result;
    outputs[node.id] = result;
  }

  const outputNode = spec.nodes.find((n) => n.type === "output");
  const finalOutput = outputNode ? outputs[outputNode.id] : Object.values(outputs).pop();
  return { finalOutput, outputs };
}
`;

const INDEX_JS = `import { runEngine } from "./engine.js";
import spec from "./pipeline.json" with { type: "json" };

/**
 * Run the pipeline. Pass an object keyed by the input fields (see pipeline.json → input.fields).
 * Returns { finalOutput, outputs } where outputs is keyed by node id.
 *
 *   import { runPipeline } from "./agents/index.js";
 *   const { finalOutput } = await runPipeline({ /* your inputs *\\/ });
 */
export async function runPipeline(input = {}) {
  return runEngine(spec, input);
}

export { spec as pipeline };
`;

function exampleJs(p: Pipeline): string {
  const example = Object.fromEntries(p.mockInputs.map((f) => [f.key, f.value || `<${f.label}>`]));
  return `import { runPipeline } from "./agents/index.js";

// Minimal usage — runs in SIMULATE mode out of the box (no key, no install).
// Set ANTHROPIC_API_KEY + \`npm install\` for real Claude output.
const input = ${JSON.stringify(example, null, 2)};

const { finalOutput, outputs } = await runPipeline(input);
console.log("Final output:\\n", finalOutput);
console.log("\\nPer-node outputs:", Object.keys(outputs).join(", "));
`;
}

function packageJson(p: Pipeline, slug: string): string {
  return JSON.stringify(
    {
      name: slug || "flowmind-agents",
      version: "1.0.0",
      private: true,
      type: "module",
      description: `${p.name} — exported from Flowmind`,
      main: "agents/index.js",
      scripts: { start: "node example.js" },
      // Only needed for real (non-simulate) runs. The package runs without it in simulate mode.
      dependencies: { "@anthropic-ai/sdk": "^0.30.1" },
    },
    null,
    2,
  );
}

function readmeMd(p: Pipeline, slug: string): string {
  const inputs = p.mockInputs.map((f) => `  - \`${f.key}\` — ${f.label}`).join("\n") || "  - (no inputs)";
  return `# ${p.name}

A self-contained, runnable export of your Flowmind pipeline. **Drop the whole \`${slug}/\` folder into
your repo** — it touches nothing else and has one entry point.

## Run it right now (no setup)

\`\`\`bash
node example.js
\`\`\`

With no API key and no install, it runs in **simulate mode** — deterministic placeholder output, so
you can confirm the wiring end-to-end immediately.

## Run it for real (Claude)

\`\`\`bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # your own key — never committed
npm start
\`\`\`

## Use it from your code (one line)

\`\`\`js
import { runPipeline } from "./${slug}/agents/index.js";

const { finalOutput, outputs } = await runPipeline({
${p.mockInputs.map((f) => `  ${f.key}: ${JSON.stringify(f.value || "…")},`).join("\n")}
});
\`\`\`

\`runPipeline(input)\` returns \`{ finalOutput, outputs }\` — \`outputs\` is keyed by node id.

### Inputs
${inputs}

## What's inside

\`\`\`
${slug}/
  agents/
    index.js       ← the one entry point: runPipeline(input)
    engine.js      ← portable runner (topological execution, model calls)
    pipeline.json  ← your graph: nodes, prompts, models, wiring
  example.js       ← minimal usage demo
  package.json
  .env.example
\`\`\`

The bundle reads your key from \`ANTHROPIC_API_KEY\` only. No Flowmind infrastructure, no secrets,
nothing to untangle. Edit \`agents/pipeline.json\` to change prompts or models.
`;
}

/** Build the clean, runnable developer bundle. Returns files rooted at the export root. */
export function buildDevBundle(p: Pipeline, tables: OutputTable[], slug: string): BundleFile[] {
  const spec = runnableSpec(p, tables);
  return [
    { path: "README.md", content: readmeMd(p, slug), description: "Drop-in + one-line usage" },
    { path: "package.json", content: packageJson(p, slug), description: "Run with: node example.js (or npm start)" },
    { path: ".env.example", content: "ANTHROPIC_API_KEY=\n", description: "Your own key — never committed" },
    { path: "example.js", content: exampleJs(p), description: "Minimal runnable usage" },
    { path: "agents/index.js", content: INDEX_JS, description: "The single entry point: runPipeline(input)" },
    { path: "agents/engine.js", content: ENGINE_JS, description: "Portable runtime (no build step)" },
    { path: "agents/pipeline.json", content: JSON.stringify(spec, null, 2), description: "Your graph: prompts, models, wiring" },
  ];
}
