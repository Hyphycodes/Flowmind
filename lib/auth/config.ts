/** Auth + connector configuration flags. Everything auth-related is OFF by default so the
 *  public demo builder works untouched. Flip `NEXT_PUBLIC_AUTH_ENABLED=true` (after enabling
 *  the Supabase Google provider) to turn on accounts. */

/** Supabase is wired (URL + anon key present). Client-safe. */
export function authConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Show account/login UI. Opt-in so an unconfigured Google provider never shows a broken
 *  sign-in button. Client-safe (NEXT_PUBLIC_*). */
export function authEnabled(): boolean {
  return authConfigured() && process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
}

/** Google OAuth (Drive connector) — server-only env. */
export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Token encryption secret present (required before storing OAuth tokens). Server-only. */
export function tokenEncryptionConfigured(): boolean {
  return Boolean(process.env.FLOWMIND_TOKEN_ENCRYPTION_SECRET);
}

/** Google Drive connector ready end-to-end. Server-only. */
export function googleDriveConfigured(): boolean {
  return googleOAuthConfigured() && tokenEncryptionConfigured() && authConfigured();
}

/** Public app URL (for OAuth redirect URIs). */
export function appUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return fromEnv || "http://localhost:3000";
}

/* ── GitHub (repo export / PR workflow — Prompt 10) ─────────────────────
 * GitHub login ≠ repo access. Repo access uses a GitHub App (preferred) so
 * permissions are repo-scoped and tokens stay server-side, never exported. */

/** Public GitHub App slug (used to build the install URL). Client-safe. */
export function githubAppSlug(): string | null {
  return process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || null;
}

/** GitHub App credentials present (server-only). Required to mint installation tokens. */
export function githubAppConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_GITHUB_APP_SLUG,
  );
}

/** OAuth-app fallback present (server-only). Used only if a GitHub App isn't configured. */
export function githubOAuthConfigured(): boolean {
  return Boolean(
    (process.env.GITHUB_APP_CLIENT_ID && process.env.GITHUB_APP_CLIENT_SECRET) ||
      (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  );
}

/** GitHub repo connection ready end-to-end (App + encryption + auth). Server-only. */
export function githubConfigured(): boolean {
  return githubAppConfigured() && tokenEncryptionConfigured() && authConfigured();
}

/* ── Billing / credits / plans (Prompt 11) ──────────────────────────────
 * Billing is OFF by default so the public demo runs unlimited/free. Flip
 * NEXT_PUBLIC_BILLING_ENABLED=true to enforce plan limits + credit gating. */

/** Show + enforce billing (plans, credits, gates). Client-safe. */
export function billingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
}

/** Stripe secret present → checkout/portal/webhook are live. Server-only. */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Stripe webhook signature verification possible. Server-only. */
export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}
