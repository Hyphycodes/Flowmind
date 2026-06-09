import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _checked = false;

/** Browser/anon Supabase client. Returns null when env isn't configured so the
 *  app degrades gracefully to local-only (no crashes). */
export function getSupabase(): SupabaseClient | null {
  if (_checked) return _client;
  _checked = true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    _client = null;
    return null;
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
