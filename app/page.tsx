import { authEnabled } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { CommandCenter } from "@/components/CommandCenter";
import { CinematicLanding } from "@/components/landing/cinematic/CinematicLanding";

export const runtime = "nodejs";

/** The post-login app surface — the studio canvas, which loads the user's latest pipeline. */
const APP_HREF = "/editor";

/** Bare `/`. When auth is OFF (the public demo), the studio Command Center is the front door.
 *  When auth is ON, `/` is the cinematic marketing landing (same component as `/home`) for
 *  BOTH audiences — session is detected server-side (no flicker) so logged-out visitors get
 *  the sales hero + "Try it now", and signed-in users get an "Open Flowmind" CTA. */
export default async function Home() {
  if (!authEnabled()) return <CommandCenter />;
  const user = await getCurrentUser();
  return <CinematicLanding signedIn={Boolean(user)} appHref={APP_HREF} />;
}
