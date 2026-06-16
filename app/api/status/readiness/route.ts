import { hasAnthropicKey } from "@/lib/ai/anthropic";
import {
  authConfigured,
  authEnabled,
  googleDriveConfigured,
  githubConfigured,
  githubAppConfigured,
  billingEnabled,
  stripeConfigured,
  stripeWebhookConfigured,
  tokenEncryptionConfigured,
} from "@/lib/auth/config";
import { PACKS } from "@/lib/pipeline/packs";
import { checkExportSafety } from "@/lib/security/secrets";

export const runtime = "nodejs";

type Level = "pass" | "warn" | "fail";
type Check = { id: string; label: string; level: Level; detail: string };

/** Beta-readiness self-check. Returns pass/warn/fail per subsystem. Never returns secret VALUES —
 *  only configured/missing booleans. Safe to expose to a signed-in user. */
export async function GET() {
  const checks: Check[] = [];
  const add = (id: string, label: string, level: Level, detail: string) => checks.push({ id, label, level, detail });

  // Auth / session
  add(
    "auth",
    "Auth",
    authConfigured() ? (authEnabled() ? "pass" : "warn") : "warn",
    authConfigured() ? (authEnabled() ? "Accounts enabled" : "Configured but disabled (public demo mode)") : "Supabase not configured",
  );

  // RLS hint (we can't query policies here; report the intended posture)
  add(
    "rls",
    "RLS / ownership",
    authEnabled() ? "pass" : "warn",
    authEnabled()
      ? "Per-user RLS active (migrations 0007–0009). Demo rows are null-owned."
      : "Transitional permissive policies for the public demo — tighten when auth is enabled.",
  );

  // AI providers
  add("providers", "AI provider (Claude)", hasAnthropicKey() ? "pass" : "warn", hasAnthropicKey() ? "ANTHROPIC_API_KEY set" : "No key — generation/runs use deterministic fallbacks");

  // Token encryption
  add("encryption", "Token encryption", tokenEncryptionConfigured() ? "pass" : "warn", tokenEncryptionConfigured() ? "FLOWMIND_TOKEN_ENCRYPTION_SECRET set" : "Required before connecting OAuth accounts");

  // Google Drive
  add("google", "Google Drive connector", googleDriveConfigured() ? "pass" : "warn", googleDriveConfigured() ? "Configured (per-file scope)" : "Optional — not configured");

  // GitHub
  add(
    "github",
    "GitHub repo connector",
    githubConfigured() ? "pass" : githubAppConfigured() ? "warn" : "warn",
    githubConfigured() ? "GitHub App + auth + encryption ready" : githubAppConfigured() ? "App set, needs auth + encryption" : "Optional — not configured",
  );

  // Stripe / billing
  if (billingEnabled()) {
    add("stripe", "Billing / Stripe", stripeConfigured() && stripeWebhookConfigured() ? "pass" : "fail", stripeConfigured() ? (stripeWebhookConfigured() ? "Stripe + webhook configured" : "Webhook secret missing") : "Billing enabled but STRIPE_SECRET_KEY missing");
  } else {
    add("stripe", "Billing / Stripe", "warn", "Billing disabled (unlimited preview). Set NEXT_PUBLIC_BILLING_ENABLED + Stripe to enable.");
  }

  // Export safety scanner (self-test with a known-bad sample)
  const sample = checkExportSafety([{ path: "fake.ts", content: 'const k = "sk-ant-0123456789abcdefghijklmnop"' }]); // pragma: allowlist secret -- fake key, scanner self-test
  const cleanSample = checkExportSafety([{ path: ".env.example", content: "ANTHROPIC_API_KEY=" }]);
  add("export_safety", "Export safety scanner", !sample.ok && cleanSample.ok ? "pass" : "fail", !sample.ok && cleanSample.ok ? "Blocks secrets, allows .env.example" : "Scanner self-test failed");

  // Demo templates
  const templateCount = PACKS.reduce((n, p) => n + p.templateIds.length, 0);
  add("templates", "Demo templates", templateCount > 0 ? "pass" : "warn", `${PACKS.length} packs · ${templateCount} templates`);

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  const verdict: Level = fails > 0 ? "fail" : warns > 0 ? "warn" : "pass";

  return Response.json({ verdict, checks, summary: { pass: checks.length - fails - warns, warn: warns, fail: fails } });
}
