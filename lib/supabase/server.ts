import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-side Supabase client for route handlers. Prefers the service-role key when
 *  present, else falls back to the anon key (permissive RLS in the V1 prototype).
 *  Returns null when env isn't configured. */
export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
