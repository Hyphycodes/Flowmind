import { NextResponse } from "next/server";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

/** OAuth / magic-link callback: exchange the code for a session, ensure a profile row,
 *  then continue to onboarding (or `next`). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/onboarding";
  const origin = url.origin;

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const sb = await getServerSupabaseAuth();
  if (!sb) return NextResponse.redirect(`${origin}/login?error=unconfigured`);

  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange`);

  // Best-effort profile creation (ignored if the table/RLS isn't set up yet).
  try {
    const { data } = await sb.auth.getUser();
    const u = data.user;
    if (u) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      await sb.from("profiles").upsert(
        {
          id: u.id,
          email: u.email,
          display_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
          avatar_url: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
        },
        { onConflict: "id" },
      );
    }
  } catch {
    /* profile creation is best-effort */
  }

  return NextResponse.redirect(`${origin}${next}`);
}
