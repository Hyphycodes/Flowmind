import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

/** Unlink Google Drive: deletes the connected account (and its encrypted tokens). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const sb = await getServerSupabaseAuth();
  if (sb) await sb.from("connected_accounts").delete().eq("user_id", user.id).eq("provider", "google");
  return Response.json({ ok: true });
}
