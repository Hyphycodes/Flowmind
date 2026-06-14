import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/user";
import { appUrl, githubConfigured, githubAppSlug } from "@/lib/auth/config";

export const runtime = "nodejs";

/** Start the GitHub App installation (repo access — SEPARATE from GitHub sign-in). The user
 *  installs the Flowmind GitHub App on selected repos; GitHub redirects back to /callback. */
export async function GET() {
  const base = appUrl();
  if (!githubConfigured()) return NextResponse.redirect(`${base}/account?github=unconfigured`);

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${base}/login?next=/account`);

  const slug = githubAppSlug();
  const state = randomBytes(16).toString("hex");
  const installUrl = `https://github.com/apps/${slug}/installations/new?state=${state}`;
  const res = NextResponse.redirect(installUrl);
  res.cookies.set("gh_install_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
