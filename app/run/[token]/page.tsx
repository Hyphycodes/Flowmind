import { effectiveShareLevel, getShareByToken, getSharedPipeline } from "@/lib/sharing/server";
import { getPricing } from "@/lib/sharing/monetization";
import { toRunAppManifest } from "@/lib/sharing/manifest";
import { RunAppClient } from "./RunAppClient";

export const runtime = "nodejs";

/** Hosted Run-App. Loads the share by token, resolves the requester's level server-side, and builds
 *  a STRIPPED manifest (input fields + output surfaces only). The raw pipeline — prompts, models,
 *  tool creds, data sources, internal steps — never reaches this page's client. */
export default async function RunAppPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await getShareByToken(token);
  const level = share ? await effectiveShareLevel(share, true) : null;
  const pipeline = share && level ? await getSharedPipeline(share.pipelineId) : null;

  if (!share || !level || !pipeline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07070c] px-6 text-center">
        <div className="max-w-sm">
          <div className="font-display text-2xl italic text-ink">flowmind</div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
            This share link isn&apos;t valid or has been turned off. Ask the owner for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  return <RunAppClient manifest={toRunAppManifest(pipeline, level, getPricing(share))} token={token} />;
}
