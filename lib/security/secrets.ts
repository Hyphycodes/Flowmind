/** Canonical secret-handling utilities (Prompt 12 hardening). Used by BOTH export paths
 *  (ZIP download + GitHub PR) and by safe error reporting. Flowmind never stores live tokens in
 *  pipeline JSON, but this is defense-in-depth against accidental leakage. SERVER + shared. */

export type SecretFinding = {
  path: string;
  rule: string;
  line: number;
  preview: string;
};

export type ExportSafetyResult = {
  ok: boolean;
  findings: SecretFinding[];
};

/** A minimal file shape so this module has no import cycle with the export bundle. */
export type ScannableFile = { path: string; content: string };

/** Patterns that indicate a real credential. Order matters only for first-match-per-line. */
const SECRET_RULES: Array<{ rule: string; re: RegExp }> = [
  { rule: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { rule: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { rule: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { rule: "Google API key", re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { rule: "Anthropic key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { rule: "Stripe secret key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { rule: "Supabase service role JWT", re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { rule: "OpenAI key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { rule: "Bearer token", re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/ },
  // KEY=value where the value is a non-placeholder, secret-looking string.
  { rule: "Assigned secret value", re: /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|CLIENT_SECRET|SERVICE_ROLE)\s*[:=]\s*["']?[A-Za-z0-9/_+=.-]{16,}/i },
];

/** Filenames that must never be exported regardless of content. */
const BLOCKED_PATHS = [/(^|\/)\.env(\.local|\.production|\.development)?$/i];

/** Scan generated export files for secrets. Returns every finding (caller decides to block). */
export function scanExportFilesForSecrets(files: ScannableFile[]): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const f of files) {
    if (BLOCKED_PATHS.some((re) => re.test(f.path))) {
      findings.push({ path: f.path, rule: "Blocked file (env/secret file)", line: 0, preview: f.path });
      continue;
    }
    const isEnvExample = /\.env\.example$/i.test(f.path);
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { rule, re } of SECRET_RULES) {
        // `.env.example` legitimately lists KEY= with empty values.
        if (isEnvExample && rule === "Assigned secret value") continue;
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

/** Convenience wrapper returning a pass/fail result. */
export function checkExportSafety(files: ScannableFile[]): ExportSafetyResult {
  const findings = scanExportFilesForSecrets(files);
  return { ok: findings.length === 0, findings };
}

/** Throws when an export would leak secrets — call before writing/zipping/committing. */
export function assertNoSecretsInExport(files: ScannableFile[]): void {
  const { ok, findings } = checkExportSafety(files);
  if (!ok) {
    const first = findings[0];
    throw new Error(
      `Export blocked: possible secret in ${first.path}${first.line ? ` (line ${first.line})` : ""} — ${first.rule}. ` +
        `${findings.length} finding(s). No files were written.`,
    );
  }
}

/** Env var name fragments whose VALUES must never appear in logs / error messages / responses. */
const SECRET_ENV_HINTS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "FLOWMIND_TOKEN_ENCRYPTION_SECRET",
  "SERPAPI_API_KEY",
  "RENTCAST_API_KEY",
  "ATTOM_API_KEY",
  "GOOGLE_PLACES_API_KEY",
];

/** Replace any known live secret value + token-like substrings with `[REDACTED]`. Use before
 *  logging errors or returning error strings to the client. Never throws. */
export function redactSecrets(value: unknown): string {
  let text = typeof value === "string" ? value : (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();

  // Redact exact live env secret values first (highest fidelity).
  for (const name of SECRET_ENV_HINTS) {
    const v = process.env[name];
    if (v && v.length >= 8) text = text.split(v).join("[REDACTED]");
  }
  // Then redact token-shaped substrings.
  for (const { re } of SECRET_RULES) {
    text = text.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), "[REDACTED]");
  }
  return text;
}
