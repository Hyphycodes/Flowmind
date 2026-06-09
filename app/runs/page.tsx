"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { hasSupabase } from "@/lib/supabase/client";
import { listRuns, type RunSummary } from "@/lib/supabase/queries";
import { timeAgo } from "@/lib/ui/format";

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);

  useEffect(() => {
    if (hasSupabase()) listRuns().then(setRuns);
    else setRuns([]);
  }, []);

  return (
    <PageShell title="Runs" subtitle="Recent pipeline executions">
      {runs === null ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-ink-faint" size={20} />
        </div>
      ) : runs.length === 0 ? (
        <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-dashed border-line p-8 text-center">
          <Play className="mx-auto mb-3 text-ink-faint" size={20} />
          <p className="text-sm text-ink-dim">No runs yet.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Open a pipeline and hit Run to see executions here.
          </p>
        </div>
      ) : (
        <div className="max-w-3xl space-y-2">
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3"
            >
              <StatusIcon status={r.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] text-ink">{r.title}</div>
                <div className="text-[11px] text-ink-faint">{timeAgo(r.createdAt)}</div>
              </div>
              <span className="text-[11px] capitalize text-ink-faint">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "error") return <XCircle size={16} className="text-red" />;
  if (status === "running") return <Loader2 size={16} className="animate-spin text-violet" />;
  return <CheckCircle2 size={16} className="text-green" />;
}
