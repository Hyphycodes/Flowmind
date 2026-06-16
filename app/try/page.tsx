import type { Metadata } from "next";
import { DemoCanvas } from "@/components/demo/DemoCanvas";

export const metadata: Metadata = {
  title: "Try Flowmind — see the brain",
  description:
    "Explore a live multi-agent AI pipeline on the real Flowmind canvas. Replay the run, read every prompt, peek the data between agents, and watch it bloom from simple to advanced. No sign-up.",
};

/** Public front-door demo. No auth, no AI calls — everything is the cached hero run (Prompt 12). */
export default function TryPage() {
  return <DemoCanvas />;
}
