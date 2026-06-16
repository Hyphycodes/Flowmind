#!/usr/bin/env node
/**
 * Repo secret audit (Prompt 12). Scans git-tracked files for committed credentials and verifies
 * that real env files are ignored. Run: `npm run audit:secrets`. No dependencies.
 * Exits non-zero if a likely secret is found — wire into CI before deploy.
 *
 * A single line may opt out with a trailing `pragma: allowlist secret` marker — reserved for
 * known-fake test fixtures (e.g. the export-safety scanner self-test). Use sparingly; it does not
 * weaken any rule, it just excuses one explicitly-marked line.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RULES = [
  ["Private key block", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["Stripe secret key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["OpenAI key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["Assigned secret value", /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|CLIENT_SECRET|SERVICE_ROLE)\s*[:=]\s*["']?[A-Za-z0-9/_+=.-]{20,}/],
];

// Skip binaries, lockfiles, and the example env (placeholders are fine).
const SKIP = [/\.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|webp|pdf|zip)$/i, /package-lock\.json$/, /\.env\.example$/];

const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
let findings = 0;

// 1. No real env files tracked.
for (const f of tracked) {
  if (/(^|\/)\.env(\.local|\.production|\.development)?$/.test(f)) {
    console.error(`✗ Tracked env file should be ignored: ${f}`);
    findings++;
  }
}

// 2. Scan content for secret patterns.
for (const f of tracked) {
  if (SKIP.some((re) => re.test(f))) continue;
  let text;
  try {
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    // Allow a line to opt out with an explicit marker — only for known-fake test fixtures
    // (e.g. the export-safety scanner self-test). Narrow + auditable; never blanket-disable.
    if (/pragma:\s*allowlist secret/i.test(lines[i])) continue;
    for (const [name, re] of RULES) {
      if (re.test(lines[i])) {
        console.error(`✗ ${name} in ${f}:${i + 1} → ${lines[i].slice(0, 80)}`);
        findings++;
        break;
      }
    }
  }
}

if (findings > 0) {
  console.error(`\n${findings} potential secret(s) found. Remove them before committing/deploying.`);
  process.exit(1);
}
console.log("✓ No committed secrets detected. .env files are ignored.");
