import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { googleDriveConfigured } from "@/lib/auth/config";
import { getGoogleAccountRow } from "@/lib/google/account";

export const runtime = "nodejs";

/** Sanitized Google Drive connection status. NEVER returns tokens. */
export async function GET() {
  if (!googleDriveConfigured()) {
    return Response.json({
      configured: false,
      connected: false,
      message: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and FLOWMIND_TOKEN_ENCRYPTION_SECRET.",
    });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ configured: true, connected: false });

  const sb = await getServerSupabaseAuth();
  const row = sb ? await getGoogleAccountRow(sb, user.id) : null;
  if (!row) return Response.json({ configured: true, connected: false });

  return Response.json({
    configured: true,
    connected: true,
    email: row.email,
    scopes: row.scopes ?? [],
    connectedAt: row.created_at,
    status: row.status ?? "connected",
  });
}
