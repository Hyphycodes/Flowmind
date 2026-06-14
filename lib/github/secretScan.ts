import type { ExportFile } from "@/lib/export/bundle";

/** Export safety check. Before pushing files to a repo we scan content for common secret
 *  patterns and block anything that looks like a real credential. Flowmind never stores live
 *  tokens in pipeline JSON, but this is a defense-in-depth guard against accidental leakage. */

export type SecretFinding = {
  path: string;
  rule: string;
  line: number;
  preview: string;
};

const RULES: Array<{ rule: string; re: RegExp }> = [
  { rule: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { rule: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { rule: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { rule: "Google API key", re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { rule: "Anthropic key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { rule: "OpenAI key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { rule: "Bearer token", re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/ },
  // KEY=value where value is a non-placeholder, secret-looking string.
  { rule: "Assigned secret value", re: /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|CLIENT_SECRET)\s*[:=]\s*["']?[A-Za-z0-9/_+=-]{16,}/i },
];

/** Files that must never be pushed regardless of content. */
const BLOCKED_PATHS = [/(^|\/)\.env(\.local|\.production|\.development)?$/i];

export function scanExportFilesForSecrets(files: ExportFile[]): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const f of files) {
    if (BLOCKED_PATHS.some((re) => re.test(f.path))) {
      findings.push({ path: f.path, rule: "Blocked file (env/secret file)", line: 0, preview: f.path });
      continue;
    }
    // `.env.example` legitimately lists KEY= with empty values — skip the assignment rule for it.
    const isEnvExample = /\.env\.example$/i.test(f.path);
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { rule, re } of RULES) {
        if (isEnvExample && rule === "Assigned secret value") continue;
        // An env var line with an empty value (KEY=) is fine everywhere.
        if (rule === "Assigned secret value" && /[:=]\s*["']?\s*$/.test(line)) continue;
        if (re.test(line)) {
          findings.push({ path: f.path, rule, line: i + 1, preview: line.slice(0, 80) });
          break;
        }
      }
    }
  }
  return findings;
}
