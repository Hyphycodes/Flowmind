import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { getFreshAccessToken, getGoogleAccountRow } from "@/lib/google/account";
import { exportDocText, getFileMeta, getFileText } from "@/lib/google/drive";

export const runtime = "nodejs";

/** File metadata (and optional ?mode=text content for Docs / text files). */
export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const mode = new URL(req.url).searchParams.get("mode") ?? "metadata";

  const user = await getCurrentUser();
  if (!user) return Response.json({ connected: false }, { status: 401 });
  const sb = await getServerSupabaseAuth();
  const row = sb ? await getGoogleAccountRow(sb, user.id) : null;
  if (!sb || !row) return Response.json({ connected: false });

  try {
    const token = await getFreshAccessToken(sb, row);
    if (!token) return Response.json({ connected: false });
    const file = await getFileMeta(token, fileId);
    if (mode === "text") {
      const text =
        file.mimeType === "application/vnd.google-apps.document"
          ? await exportDocText(token, fileId)
          : await getFileText(token, fileId);
      return Response.json({ connected: true, file, text });
    }
    return Response.json({ connected: true, file });
  } catch (err) {
    return Response.json({ connected: true, error: (err as Error).message }, { status: 502 });
  }
}
