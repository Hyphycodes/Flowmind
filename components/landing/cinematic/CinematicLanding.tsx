"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "./Hero";
import { ImportBeat } from "./ImportBeat";
import { Bento } from "./Bento";
import { PositioningPoster, FinalCTA } from "./Closing";

/** Cinematic landing (the /home rebuild). Void-black, one violet accent, the
 *  product animating itself into existence — built from the real node/edge
 *  language + design tokens. Atmosphere video lives only in the Hero. */
export function CinematicLanding({ signedIn = false, appHref = "/editor" }: { signedIn?: boolean; appHref?: string }) {
  const ctaHref = signedIn ? appHref : "/try";
  const ctaLabel = signedIn ? "Open Flowmind" : "Try it now";

  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line/60 bg-canvas/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="font-display text-[22px] italic leading-none tracking-tight text-ink">
            flowmind
          </Link>
          <nav className="flex items-center gap-2">
            {signedIn ? (
              <Link
                href={appHref}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
              >
                Open Flowmind <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-1.5 text-[13px] text-ink-dim transition hover:text-ink">
                  Log in
                </Link>
                <Link
                  href="/try"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-violet/90"
                >
                  Try it now <ArrowRight size={14} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Hero ctaHref={ctaHref} ctaLabel={ctaLabel} />
        <ImportBeat />
        <Bento />
        <PositioningPoster />
        <FinalCTA ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </main>

      {/* Footer — minimal, same tokens. */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-[12px] text-ink-faint sm:flex-row sm:px-8">
          <span className="font-display text-[16px] italic text-ink-dim">flowmind</span>
          <div className="flex items-center gap-5">
            <Link href="/try" className="transition hover:text-ink">
              Try the demo
            </Link>
            {signedIn ? (
              <Link href={appHref} className="transition hover:text-ink">
                Open Flowmind
              </Link>
            ) : (
              <Link href="/login" className="transition hover:text-ink">
                Log in
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
