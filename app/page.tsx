import { authEnabled } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { CommandCenter } from "@/components/CommandCenter";
import { Landing } from "@/components/landing/Landing";

export const runtime = "nodejs";

/** The post-login app surface — the studio canvas, which loads the user's latest pipeline. */
const APP_HREF = "/editor";

/** Bare `/`. When auth is OFF (the public demo), the studio Command Center is the front door.
 *  When auth is ON, `/` is the marketing landing for BOTH audiences — session is detected
 *  server-side (no flicker) so logged-out visitors get the sales hero + "Try it now", and
 *  signed-in users get a returning-user hero + a one-click "Open Flowmind →". */
export default async function Home() {
  if (!authEnabled()) return <CommandCenter />;
  const user = await getCurrentUser();
  return <Landing signedIn={Boolean(user)} appHref={APP_HREF} />;
}
