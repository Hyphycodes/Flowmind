"use client";

import { useEffect, useState } from "react";
import { Check, Database, X } from "lucide-react";

type ToolRow = {
  id: string;
  name: string;
  category: string;
  status: "ready" | "missing_key" | "disabled" | "error" | "unknown";
  missingEnvVars: string[];
  enabled: boolean;
  fallbackDatasetId?: string;
  mockable: boolean;
};

export function ToolRegistry() {
  const [tools, setTools] = useState<ToolRow[]>([]);

  useEffect(() => {
    fetch("/api/tools/status")
      .then((res) => res.json())
      .then((json) => setTools(json.tools ?? []))
      .catch(() => setTools([]));
  }, []);

  return (
    <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Tool Registry</h2>
      <div className="space-y-2.5">
        {tools.map((tool) => (
          <div key={tool.id} className="rounded-lg border border-line bg-black/20 p-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] text-ink">
                  <Database size={13} className="text-ink-faint" />
                  <span className="truncate">{tool.name}</span>
                </div>
                <div className="mt-0.5 text-[10.5px] text-ink-faint">
                  {tool.category.replace("_", " ")}
                  {tool.fallbackDatasetId ? ` · fallback ${tool.fallbackDatasetId}` : ""}
                </div>
              </div>
              <span className={`flex shrink-0 items-center gap-1.5 text-[11px] ${tool.status === "ready" ? "text-green" : "text-ink-faint"}`}>
                {tool.status === "ready" ? <Check size={12} /> : <X size={12} />}
                {tool.status === "ready" ? "Ready" : tool.status === "missing_key" ? "Missing key" : tool.status}
              </span>
            </div>
            {tool.missingEnvVars.length > 0 && (
              <div className="mt-1.5 font-mono text-[10px] text-ink-faint">
                {tool.missingEnvVars.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
