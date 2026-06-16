import { authEnabled } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { CommandCenter } from "@/components/CommandCenter";
import { Landing } from "@/components/landing/Landing";

export const runtime = "nodejs";

/** Bare `/`. Logged-out visitors see the landing page when auth is enabled; everyone else — the
 *  public demo (auth off) and signed-in users — goes straight to the Command Center. Existing
 *  users are never gated behind the marketing page. */
export default async function Home() {
  if (authEnabled()) {
    const user = await getCurrentUser();
    if (!user) return <Landing />;
  }
  return <CommandCenter />;
}
