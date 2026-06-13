import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cookie-aware browser Supabase client for auth (login, session, sign-out). Separate from
 *  the legacy anon `client.ts` used by the demo data path. Returns null when unconfigured. */
let _client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createBrowserClient(url, key);
  return _client;
}
