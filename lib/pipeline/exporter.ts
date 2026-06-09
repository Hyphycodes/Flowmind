import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { FinalOutput, OutputTable, Pipeline } from "./schema";

export type ExportRun = {
  steps?: unknown;
  tables?: OutputTable[];
  finalOutput?: FinalOutput | null;
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pipeline"
  );
}

function runnerTs(p: Pipeline): string {
  return [
    `/**`,
    ` * Standalone runner for "${p.name}".`,
    ` * Topologically executes nodes. Replace runNode() with real model/tool calls.`,
    ` *`,
    ` *   npx tsx run-pipeline.ts`,
    ` */`,
    `import pipeline from "./pipeline.json";`,
    `import mock from "./mock-data.json";`,
    ``,
    `type Node = (typeof pipeline)["nodes"][number];`,
    ``,
    `function topoOrder(): string[] {`,
    `  const indeg: Record<string, number> = {};`,
    `  const adj: Record<string, string[]> = {};`,
    `  for (const n of pipeline.nodes) { indeg[n.id] = 0; adj[n.id] = []; }`,
    `  for (const e of pipeline.edges) { adj[e.source]?.push(e.target); indeg[e.target]++; }`,
    `  const q = pipeline.nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id);`,
    `  const order: string[] = [];`,
    `  while (q.length) {`,
    `    const u = q.shift()!; order.push(u);`,
    `    for (const v of adj[u] ?? []) { if (--indeg[v] === 0) q.push(v); }`,
    `  }`,
    `  return order;`,
    `}`,
    ``,
    `// TODO: wire this to your model/provider (e.g. the Anthropic API).`,
    `async function runNode(node: Node, inputs: Record<string, unknown>) {`,
    `  console.log("→", node.title, "(" + node.type + ")");`,
    `  // Mock: echo the seeded table for this node's first output, if any.`,
    `  const key = node.outputs?.[0];`,
    `  const seeded = (mock.tables ?? []).find((t: any) => t.id === key);`,
    `  return { [key ?? node.id]: seeded ?? null };`,
    `}`,
    ``,
    `async function main() {`,
    `  const order = topoOrder();`,
    `  const outputs: Record<string, unknown> = {};`,
    `  for (const id of order) {`,
    `    const node = pipeline.nodes.find((n) => n.id === id)!;`,
    `    const res = await runNode(node, outputs);`,
    `    Object.assign(outputs, res);`,
    `  }`,
    `  console.log("\\nFinal output:\\n", JSON.stringify(mock.finalOutput ?? outputs, null, 2));`,
    `}`,
    ``,
    `main();`,
    ``,
  ].join("\n");
}

function readmeMd(p: Pipeline): string {
  const nodeList = p.nodes
    .map((n) => `- **${n.title}** (\`${n.type}\`)${n.role ? ` — ${n.role}` : ""}`)
    .join("\n");
  const tableList = p.outputTables.map((t) => `- \`${t.name}\``).join("\n");
  return [
    `# ${p.name}`,
    ``,
    p.description || "An exported Flowmind agent pipeline.",
    ``,
    `## Nodes`,
    ``,
    nodeList,
    ``,
    `## Output tables`,
    ``,
    tableList || "_None_",
    ``,
    `## Run the mock`,
    ``,
    "```bash",
    `npm i -D tsx`,
    `npx tsx run-pipeline.ts`,
    "```",
    ``,
    `## Replace mock nodes with real calls`,
    ``,
    `Open \`run-pipeline.ts\` and implement \`runNode()\` for each agent — call your model`,
    `provider (e.g. the Anthropic API) with each node's \`prompt\`, passing the upstream`,
    `outputs as context, and return structured rows for the node's output table(s).`,
    ``,
    `## Files`,
    ``,
    `- \`pipeline.json\` — the validated pipeline graph (nodes, edges, tables, UI bindings).`,
    `- \`agents/*.json\` — one file per node (role, prompt, model, inputs, outputs).`,
    `- \`mock-data.json\` — seeded inputs, tables, and final output.`,
    `- \`run-pipeline.ts\` — standalone topological runner.`,
    `- \`spec.md\` — human-readable architecture spec.`,
    ``,
  ].join("\n");
}

function specMd(p: Pipeline): string {
  const edges = p.edges
    .map((e) => `- \`${e.source}\` → \`${e.target}\`${e.dataKey ? ` (\`${e.dataKey}\`)` : ""}`)
    .join("\n");
  const bindings = p.uiBindings
    .map((b) => `- \`${b.tableId}\` → **${b.componentType}** (${b.title || "untitled"})`)
    .join("\n");
  return [
    `# ${p.name} — Spec`,
    ``,
    `## Overview`,
    ``,
    p.description || "_No description._",
    ``,
    `## Data flow`,
    ``,
    edges || "_No edges._",
    ``,
    `## UI bindings`,
    ``,
    bindings || "_No UI bindings._",
    ``,
    `## Schema`,
    ``,
    `Each node: \`{ id, type, title, role, prompt, model, inputs[], outputs[], team? }\`.`,
    `A node may carry an optional \`team\` (strategy + agents[]) for multi-agent execution.`,
    `Output tables: \`{ id, name, sourceNodeId, columns[], rows[] }\`.`,
    ``,
  ].join("\n");
}

/** Build + download a zip of the pipeline and its latest run. */
export async function exportPipeline(pipeline: Pipeline, run?: ExportRun | null): Promise<void> {
  const zip = new JSZip();
  zip.file("pipeline.json", JSON.stringify(pipeline, null, 2));

  const agents = zip.folder("agents");
  if (agents) {
    for (const n of pipeline.nodes) {
      agents.file(
        `${n.id}.json`,
        JSON.stringify(
          {
            id: n.id,
            type: n.type,
            title: n.title,
            role: n.role,
            prompt: n.prompt,
            model: n.model,
            inputs: n.inputs,
            outputs: n.outputs,
            team: n.team ?? null,
          },
          null,
          2,
        ),
      );
    }
  }

  zip.file(
    "mock-data.json",
    JSON.stringify(
      {
        inputs: pipeline.mockInputs,
        tables: run?.tables ?? pipeline.outputTables,
        finalOutput: run?.finalOutput ?? null,
      },
      null,
      2,
    ),
  );
  zip.file("run-pipeline.ts", runnerTs(pipeline));
  zip.file("README.md", readmeMd(pipeline));
  zip.file("spec.md", specMd(pipeline));

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${slugify(pipeline.name)}.zip`);
}
