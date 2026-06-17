/**
 * Prompt 22 Stage 3 — generate the developer bundle from the hero pipeline, write it to a temp
 * folder, and ACTUALLY RUN it via its documented entry point in a clean environment (no install,
 * no API key → simulate mode). Confirms the package executes and produces output.
 *
 * Run: npx tsx scripts/prove-export-bundle.ts
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { buildDevBundle } from "../lib/export/devBundle";
import { researchCrewPipeline } from "../lib/pipeline/teamFixtures";

const dir = mkdtempSync(join(tmpdir(), "flowmind-export-"));
const files = buildDevBundle(researchCrewPipeline, researchCrewPipeline.outputTables, "research-crew");

console.log(`Writing ${files.length} files to ${dir}`);
for (const f of files) {
  const full = join(dir, f.path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, f.content);
  console.log(`  ${f.path}`);
}

console.log("\nRunning `node example.js` in a clean env (no install, no key)…\n");
const out = execFileSync("node", ["example.js"], { cwd: dir, encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "" } });
console.log(out);
console.log("✓ The exported developer bundle runs via its documented entry point and produces output.");
