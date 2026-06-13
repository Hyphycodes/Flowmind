import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { googleDriveConfigured } from "@/lib/auth/config";
import { encryptToken } from "@/lib/auth/tokens";
import { exchangeCode, fetchUserEmail } from "@/lib/google/oauth";

export const runtime = "nodejs";

/** Google Drive OAuth callback: verify state, exchange code, store ENCRYPTED tokens. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!googleDriveConfigured()) return NextResponse.redirect(`${origin}/account?drive=unconfigured`);

  const cookieStore = await cookies();
  const saved = cookieStore.get("g_oauth_state")?.value;
  if (!code || !state || state !== saved) return NextResponse.redirect(`${origin}/account?drive=state_error`);

  const user = await getCurrentUser();
  const sb = await getServerSupabaseAuth();
  if (!user || !sb) return NextResponse.redirect(`${origin}/login?next=/account`);

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchUserEmail(tokens.access_token);
    await sb.from("connected_accounts").upsert(
      {
        user_id: user.id,
        provider: "google",
        email,
        scopes: tokens.scope ? tokens.scope.split(" ") : [],
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
  } catch {
    return NextResponse.redirect(`${origin}/account?drive=error`);
  }

  const res = NextResponse.redirect(`${origin}/account?connected=google`);
  res.cookies.delete("g_oauth_state");
  return res;
}
