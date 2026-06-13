import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { getFreshAccessToken, getGoogleAccountRow } from "@/lib/google/account";
import { listFiles } from "@/lib/google/drive";

export const runtime = "nodejs";

/** List the user's Drive files (the app sees only files granted via drive.file / Picker). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ connected: false, files: [] }, { status: 401 });
  const sb = await getServerSupabaseAuth();
  const row = sb ? await getGoogleAccountRow(sb, user.id) : null;
  if (!sb || !row) return Response.json({ connected: false, files: [] });
  try {
    const token = await getFreshAccessToken(sb, row);
    if (!token) return Response.json({ connected: false, files: [] });
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    return Response.json({ connected: true, files: await listFiles(token, { q }) });
  } catch (err) {
    return Response.json({ connected: true, error: (err as Error).message, files: [] }, { status: 502 });
  }
}
