"use client";

/** Hero ATMOSPHERE — the Higgsfield-generated "data in the void" loop sits here,
 *  behind everything, with a dark overlay so the headline + graph stay legible.
 *
 *  Until a clip is chosen + optimized into public/hero/, HERO_CLIP stays null:
 *  the section renders its on-brand near-black base alone (no broken <video>,
 *  no console noise). Dropping the files in and flipping HERO_CLIP lights it up
 *  with zero other changes. Reduced motion → poster only, never autoplay. */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// Set to "hero" once public/hero/hero.webm + hero.mp4 + hero-poster.jpg exist.
const HERO_CLIP: string | null = "hero";

export function Atmosphere() {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduce) return;
    // Autoplay can be rejected on low-power devices; the poster then remains.
    v.play().catch(() => {});
  }, [reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Base: true near-black + a single restrained violet wash (one accent, no
          multi-color blobs) — stands on its own if the clip never loads. */}
      <div className="absolute inset-0" style={{ background: "var(--color-canvas)" }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(1100px 620px at 50% -8%, rgba(139,92,246,0.16), transparent 60%)" }}
      />

      {HERO_CLIP && !reduce ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={`/hero/${HERO_CLIP}-poster.jpg`}
        >
          <source src={`/hero/${HERO_CLIP}.webm`} type="video/webm" />
          <source src={`/hero/${HERO_CLIP}.mp4`} type="video/mp4" />
        </video>
      ) : HERO_CLIP ? (
        // Reduced motion: static poster, no autoplay.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/hero/${HERO_CLIP}-poster.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      ) : null}

      {/* Legibility overlay: darken toward the bottom where content sits, plus a
          gentle vignette. Keeps text/graph at WCAG-AA contrast over the video. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,7,12,0.55) 0%, rgba(7,7,12,0.4) 32%, rgba(7,7,12,0.72) 78%, var(--color-canvas) 100%)",
        }}
      />
      {/* Text scrim — a soft dark ellipse behind the headline/CTA so contrast
          holds over the brightest mist, while edges keep the video visible. */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(62% 52% at 50% 34%, rgba(7,7,12,0.72), transparent 72%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 240px 40px rgba(7,7,12,0.9)" }}
      />
    </div>
  );
}
