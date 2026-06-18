"use client";

import { useEffect, useRef, useState } from "react";

/** Measure a container's width (ResizeObserver) so a fixed-px "stage" can be
 *  scaled to fit fluidly without distorting node/edge geometry. Returns 0 until
 *  measured (caller renders nothing / a placeholder until > 0). */
export function useMeasuredWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let settled = false;
    const apply = (cw: number) => {
      if (cw > 0) {
        settled = true;
        setW(cw);
      }
    };
    const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? el.clientWidth));
    ro.observe(el);
    apply(el.clientWidth || el.getBoundingClientRect().width);
    // If still unmeasured shortly after mount (a degenerate / detached layout
    // context where every width API reads ~0), assume a desktop width so the
    // graph renders instead of collapsing. Real browsers settle in a frame.
    const fb = setTimeout(() => {
      if (!settled) setW(el.parentElement?.clientWidth || 1024);
    }, 400);
    return () => {
      ro.disconnect();
      clearTimeout(fb);
    };
  }, []);
  return [ref, w];
}

/** Sanitize a measured container width before driving a fixed-px stage. A real
 *  graph container is never a few px wide; if measurement returns a degenerate
 *  value (detached/zero-size layout contexts), fall back to a desktop width so
 *  the graph renders its intended layout instead of collapsing. 0 stays 0
 *  (unmeasured → caller renders nothing until the first real measurement). */
export function stageWidth(raw: number, fallback = 1024): number {
  if (raw === 0) return 0;
  return raw < 80 ? fallback : raw;
}

/** True once the element has entered the viewport (one-shot). Drives
 *  scroll-into-view stagger without re-triggering on scroll-back. */
export function useInViewOnce<T extends HTMLElement>(rootMargin = "-12% 0px"): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen];
}
