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
