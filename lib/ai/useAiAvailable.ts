"use client";

import { useEffect, useState } from "react";

/** Client-side probe for whether an Anthropic key is configured server-side, so AI-only
 *  affordances (e.g. Explain) can hide cleanly. Cached process-wide after the first call.
 *  Never exposes the key — only the boolean from /api/status. */
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function probe(): Promise<boolean> {
  if (cached != null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/status")
      .then((r) => r.json())
      .then((j) => (cached = Boolean(j?.anthropic)))
      .catch(() => (cached = false));
  }
  return inflight;
}

export function useAiAvailable(): boolean | null {
  const [value, setValue] = useState<boolean | null>(cached);
  useEffect(() => {
    if (cached == null) void probe().then(setValue);
  }, []);
  return cached != null ? cached : value;
}
