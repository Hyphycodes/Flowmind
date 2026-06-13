import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/auth/tokens";
import { refreshAccessToken } from "./oauth";

export type GoogleAccountRow = {
  id: string;
  user_id: string;
  email: string | null;
  scopes: string[] | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function getGoogleAccountRow(
  sb: SupabaseClient,
  userId: string,
): Promise<GoogleAccountRow | null> {
  const { data, error } = await sb
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("status", "connected")
    .maybeSingle();
  if (error || !data) return null;
  return data as GoogleAccountRow;
}

/** Decrypt the access token, refreshing + persisting if it has expired. Never returns to client. */
export async function getFreshAccessToken(sb: SupabaseClient, row: GoogleAccountRow): Promise<string | null> {
  if (!row.access_token_encrypted) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return decryptToken(row.access_token_encrypted);
  if (!row.refresh_token_encrypted) return decryptToken(row.access_token_encrypted);
  try {
    const refreshed = await refreshAccessToken(decryptToken(row.refresh_token_encrypted));
    await sb
      .from("connected_accounts")
      .update({
        access_token_encrypted: encryptToken(refreshed.access_token),
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return refreshed.access_token;
  } catch {
    return decryptToken(row.access_token_encrypted);
  }
}
