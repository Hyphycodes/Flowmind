import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role Supabase client for trusted server contexts (Stripe webhook) that act outside a
 *  user session and must bypass RLS. SERVER ONLY — the service key is never sent to the client.
 *  Returns null when not configured (webhook then no-ops gracefully). */
export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
