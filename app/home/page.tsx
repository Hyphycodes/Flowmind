import type { Metadata } from "next";
import { authEnabled } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { CinematicLanding } from "@/components/landing/cinematic/CinematicLanding";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Flowmind — See inside your AI system",
  description:
    "You built the AI. Now see inside it. Describe a multi-agent system, watch it assemble as a node-and-team graph, run it on real models, and inspect exactly what every agent did.",
};

/** The rebuilt cinematic landing, always reachable at /home regardless of the
 *  auth flag (the public-demo front door at `/` is intentionally untouched).
 *  Session is detected server-side so the CTAs adapt without a flash. */
export default async function HomePage() {
  const user = authEnabled() ? await getCurrentUser() : null;
  return <CinematicLanding signedIn={Boolean(user)} appHref="/editor" />;
}
