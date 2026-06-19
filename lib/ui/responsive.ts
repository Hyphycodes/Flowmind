"use client";

import { useEffect, useState } from "react";

/** True when the viewport is at/below a max width (default = Tailwind `md`, 767px).
 *  SSR-safe: false until mounted, so server and first client render agree. */
export function useIsMobile(maxWidth = 767): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [maxWidth]);
  return mobile;
}

/** True only on real touch devices at phone width — width ≤ 767px AND a coarse
 *  pointer. Gates the canvas viewer mode so a narrow *desktop* window (mouse)
 *  keeps the full editor. SSR-safe (false until mounted). */
export function useTouchViewport(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const on = () => setTouch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return touch;
}
