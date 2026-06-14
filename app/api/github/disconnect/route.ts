import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

/** Unlink GitHub: removes the stored connection metadata. (The user should also uninstall the
 *  Flowmind GitHub App from their repo settings to fully revoke repo access.) */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const sb = await getServerSupabaseAuth();
  if (sb) await sb.from("github_connections").delete().eq("user_id", user.id).eq("provider", "github");
  return Response.json({ ok: true });
}
