"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Tracked = { id: string; name: string; presence_ref?: string };

/** Lightweight Supabase Realtime presence (Task 07): who else is in this workspace / on this
 *  pipeline. Renders co-members as avatars. Degrades to nothing with no session/Supabase. */
export function WorkspacePresence({ channel }: { channel: string }) {
  const [others, setOthers] = useState<Tracked[]>([]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    let mounted = true;
    let unsub: (() => void) | undefined;

    void (async () => {
      const { data } = await sb.auth.getUser();
      const me = data.user;
      if (!me || !mounted) return;
      const ch = sb.channel(channel, { config: { presence: { key: me.id } } });
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<Tracked>();
        const seen = new Set<string>();
        const people = Object.values(state)
          .flat()
          .filter((p) => p.id !== me.id && !seen.has(p.id) && seen.add(p.id) != null);
        if (mounted) setOthers(people);
      });
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") void ch.track({ id: me.id, name: me.email ?? "You" });
      });
      unsub = () => void sb.removeChannel(ch);
    })();

    return () => {
      mounted = false;
      unsub?.();
    };
  }, [channel]);

  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {others.slice(0, 4).map((p) => (
          <span
            key={p.id}
            title={p.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#0b0b13] bg-gradient-to-br from-violet to-pink text-[10px] font-semibold text-white"
          >
            {(p.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
        ))}
      </div>
      <span className="text-[10.5px] text-ink-faint">
        {others.length} other{others.length === 1 ? "" : "s"} here
      </span>
    </div>
  );
}
