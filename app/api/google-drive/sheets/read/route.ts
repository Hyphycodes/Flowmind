import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { getFreshAccessToken, getGoogleAccountRow } from "@/lib/google/account";
import { readSheet } from "@/lib/google/drive";

export const runtime = "nodejs";

/** Read a Google Sheets range → headers + row objects (usable as a Dataset / Source table). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const spreadsheetId = url.searchParams.get("spreadsheetId");
  const range = url.searchParams.get("range") ?? "A1:Z200";
  if (!spreadsheetId) return Response.json({ error: "spreadsheetId is required" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ connected: false }, { status: 401 });
  const sb = await getServerSupabaseAuth();
  const row = sb ? await getGoogleAccountRow(sb, user.id) : null;
  if (!sb || !row) return Response.json({ connected: false });

  try {
    const token = await getFreshAccessToken(sb, row);
    if (!token) return Response.json({ connected: false });
    const result = await readSheet(token, spreadsheetId, range);
    return Response.json({ connected: true, ...result });
  } catch (err) {
    return Response.json({ connected: true, error: (err as Error).message }, { status: 502 });
  }
}
