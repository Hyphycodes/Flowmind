"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

type ProviderRow = {
  id: string;
  name: string;
  status: "ready" | "missing_key" | "disabled" | "error" | "unknown";
  missingEnvNames: string[];
  enabledModelsCount: number;
};

export function ProviderStatus() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);

  useEffect(() => {
    fetch("/api/providers/status")
      .then((res) => res.json())
      .then((json) => setProviders(json.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Model Providers</h2>
      <div className="space-y-2.5">
        {providers.map((provider) => (
          <div key={provider.id} className="flex items-start justify-between gap-4 text-[13px]">
            <div>
              <div className="text-ink">{provider.name}</div>
              <div className="mt-0.5 text-[10.5px] text-ink-faint">
                {provider.enabledModelsCount} model{provider.enabledModelsCount === 1 ? "" : "s"}
                {provider.missingEnvNames.length ? ` · missing ${provider.missingEnvNames.join(", ")}` : ""}
              </div>
            </div>
            <span className={`flex items-center gap-1.5 text-[12px] ${provider.status === "ready" ? "text-green" : "text-ink-faint"}`}>
              {provider.status === "ready" ? <Check size={13} /> : <X size={13} />}
              {provider.status === "ready" ? "Ready" : provider.status === "missing_key" ? "Missing key" : provider.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
