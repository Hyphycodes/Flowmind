/**
 * Prompt 19b proof — feed hand-made edit proposals (as the planner would emit) through the
 * deterministic safety layer and show: targeted edits touch only their node, multi-node edits wire
 * cleanly, and cycle / orphan changes are REFUSED with a reason. No live AI — this proves the
 * code-level guarantees the chat editor relies on.
 *
 * Run: npx tsx scripts/prove-surgical-edit.ts
 */
import { researchPipeline } from "../lib/pipeline/fixtures";
import { applyChangesToPipeline, graphIntegrity, screenChanges, type EditChange } from "../lib/pipeline/editDiff";

const base = researchPipeline;
console.log(`BASE: "${base.name}" — ${base.nodes.length} nodes, ${base.edges.length} edges`);
console.log(`  integrity: ${JSON.stringify(graphIntegrity(base))}`);

function run(title: string, change: EditChange) {
  const screened = screenChanges(base, [change]);
  const accepted = screened.length === 1;
  const { pipeline: after, applied, skipped } = applyChangesToPipeline(base, [change]);
  const changedNodeIds = after.nodes
    .filter((n) => {
      const b = base.nodes.find((x) => x.id === n.id);
      return b && JSON.stringify({ p: b.prompt, m: b.model, t: b.title }) !== JSON.stringify({ p: n.prompt, m: n.model, t: n.title });
    })
    .map((n) => n.id);
  console.log(`\n▶ ${title}`);
  console.log(`  screened: ${accepted ? "ACCEPTED" : "REFUSED"}${skipped.length ? ` (reason: ${skipped[0].reason})` : ""}`);
  console.log(`  applied=${applied.length}  nodes ${base.nodes.length}→${after.nodes.length}  field-changed nodes: [${changedNodeIds.join(", ") || "none"}]`);
}

// 1) Targeted prompt edit — should touch ONLY the summarizer.
run("Targeted: improve only the Summarizer's prompt", {
  id: "c1",
  summary: "Make the Summarizer sharper",
  why: "User asked to make the summarizer smarter.",
  depends_on: [],
  diff: { add_nodes: [], remove_nodes: [], add_edges: [], remove_edges: [], modify_nodes: [{ id: "summarizer", prompt: "Reason step by step, then distill 3–5 findings with confidence." }] },
});

// 2) Multi-node: insert a fact-checker between summarizer and contradiction-checker.
run("Multi-node: insert a Fact Checker after the Summarizer", {
  id: "c2",
  summary: "Add a Fact Checker after the Summarizer",
  why: "Catch unsupported claims before the report.",
  depends_on: [],
  diff: {
    add_nodes: [{ id: "fact_checker", type: "evaluator", title: "Fact Checker", role: "verifies claims", prompt: "Check each finding against the sources; flag unsupported ones.", model: "claude-sonnet-4-6", inputs: ["key_findings"], outputs: ["checked_findings_v2"] }],
    remove_nodes: [],
    add_edges: [{ source: "summarizer", target: "fact_checker", dataKey: "key_findings" }, { source: "fact_checker", target: "report-generator", dataKey: "checked_findings_v2" }],
    remove_edges: [],
    modify_nodes: [],
  },
});

// 3) Cycle — wire the report-generator (output-feeding) back into the source-collector. Must REFUSE.
run("Unsafe: create a cycle (report → source-collector)", {
  id: "c3",
  summary: "Loop the report back to the collector",
  why: "(intentionally invalid)",
  depends_on: [],
  diff: { add_nodes: [], remove_nodes: [], add_edges: [{ source: "report-generator", target: "source-collector" }], remove_edges: [], modify_nodes: [] },
});

// 4) Orphan — add a floating node with no edges. Must REFUSE.
run("Unsafe: add a node with no wiring (orphan)", {
  id: "c4",
  summary: "Add an unconnected node",
  why: "(intentionally invalid)",
  depends_on: [],
  diff: { add_nodes: [{ id: "floating", type: "agent", title: "Floating", prompt: "x", model: "claude-sonnet-4-6", inputs: [], outputs: ["nothing"] }], remove_nodes: [], add_edges: [], remove_edges: [], modify_nodes: [] },
});

console.log("");
