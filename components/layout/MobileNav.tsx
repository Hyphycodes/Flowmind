"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "./Sidebar";

/** Mobile-only (below `md`) top bar + slide-in drawer. Reuses SidebarContent so
 *  the nav stays in one place. Desktop renders nothing (the persistent rail does
 *  the job). Closes on overlay tap, the close button, Esc, or any nav tap. */
export function MobileNav({ title, onNewPipeline }: { title?: string; onNewPipeline?: () => void }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll + Esc-to-close while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-[#09090f]/80 px-4 backdrop-blur-xl">
        <span className="truncate font-display text-[19px] italic leading-none text-ink">{title || "flowmind"}</span>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="-mr-1.5 flex h-11 w-11 items-center justify-center rounded-lg text-ink-dim transition hover:bg-white/[0.06] hover:text-ink"
        >
          <Menu size={21} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 right-0 z-50 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-l border-line bg-[#09090f]/95 px-4 py-5 backdrop-blur-xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute right-2.5 top-3.5 flex h-11 w-11 items-center justify-center rounded-lg text-ink-dim transition hover:bg-white/[0.06] hover:text-ink"
              >
                <X size={19} />
              </button>
              <SidebarContent onNewPipeline={onNewPipeline} onNavigate={() => setOpen(false)} large />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
