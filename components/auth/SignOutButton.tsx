"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy(true);
    await sb.auth.signOut();
    window.location.href = "/";
  };
  return (
    <button
      onClick={() => void signOut()}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5 text-[12px] text-ink-dim transition hover:text-ink disabled:opacity-50"
    >
      <LogOut size={13} /> Sign out
    </button>
  );
}
