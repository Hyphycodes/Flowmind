import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/user";
import { appUrl, googleDriveConfigured } from "@/lib/auth/config";
import { buildConsentUrl } from "@/lib/google/oauth";

export const runtime = "nodejs";

/** Start the Google Drive connection (separate from sign-in). Drive access is per-file. */
export async function GET() {
  const base = appUrl();
  if (!googleDriveConfigured()) return NextResponse.redirect(`${base}/account?drive=unconfigured`);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${base}/login?next=/account`);

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildConsentUrl(state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
