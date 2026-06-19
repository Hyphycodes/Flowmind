"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, X } from "lucide-react";

/** Subtle, intentional banner shown once per session in the mobile canvas viewer.
 *  Not an error — just sets the expectation that editing lives on desktop. */
export function ViewerBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("fm_viewer_banner")) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem("fm_viewer_banner", "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="pointer-events-auto absolute inset-x-3 top-3 z-30 flex items-center gap-2 rounded-xl border border-line bg-[#0c0c14]/90 px-3 py-2 backdrop-blur-md"
        >
          <Info size={14} className="shrink-0 text-violet" />
          <span className="flex-1 text-[12px] leading-snug text-ink-dim">Viewing only — editing is available on desktop.</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-faint transition hover:text-ink"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
