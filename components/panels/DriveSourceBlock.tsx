"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Link2, Loader2 } from "lucide-react";
import type { OutputTable, PipelineNode } from "@/lib/pipeline/schema";
import { usePipelineStore } from "@/store/pipelineStore";
import { datasetFromTable } from "@/lib/datasets/utils";
import { cn } from "@/lib/ui/cn";

type Status = { configured: boolean; connected: boolean; email?: string | null };

export function DriveSourceBlock({ node }: { node: PipelineNode }) {
  const setNodeDriveSource = usePipelineStore((s) => s.setNodeDriveSource);
  const upsertDataset = usePipelineStore((s) => s.upsertDataset);
  const applyDatasetToNode = usePipelineStore((s) => s.applyDatasetToNode);
  const setNotice = usePipelineStore((s) => s.setNotice);

  const drive = node.source?.drive;
  const [status, setStatus] = useState<Status | null>(null);
  const [fileId, setFileId] = useState(drive?.fileIds?.[0] ?? "");
  const [contentMode, setContentMode] = useState(drive?.contentMode ?? "metadata");
  const [range, setRange] = useState(drive?.range ?? "Sheet1!A1:Z200");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/google/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false, connected: false }));
  }, []);

  const save = () => {
    setNodeDriveSource(node.id, {
      pickMode: "manual_file_id",
      fileIds: fileId ? [fileId] : [],
      contentMode,
      range: contentMode === "sheet_rows" ? range : undefined,
      mimeTypes: [],
      files: drive?.files ?? [],
    });
    setNotice("Drive file bound to this source.");
  };

  const applyDriveAsSource = async () => {
    if (!fileId) return;
    setBusy(true);
    setPreview(null);
    try {
      if (contentMode === "sheet_rows") {
        const res = await fetch(`/api/google-drive/sheets/read?spreadsheetId=${encodeURIComponent(fileId)}&range=${encodeURIComponent(range)}`);
        const j = await res.json();
        if (!res.ok || !j.connected) throw new Error(j.error ?? "Not connected");
        const headers: string[] = j.headers ?? [];
        const rows: Record<string, unknown>[] = j.rows ?? [];
        const table: OutputTable = {
          id: node.outputs[0] ?? "drive_rows",
          name: node.outputs[0] ?? "drive_rows",
          sourceNodeId: node.id,
          description: "From Google Sheets",
          columns: headers.map((h) => ({ key: h, label: h, type: "text" as const })),
          rows,
        };
        const ds = datasetFromTable(table, { name: `Drive Sheet ${fileId.slice(0, 6)}`, mode: "google_drive" });
        upsertDataset(ds);
        applyDatasetToNode(node.id, ds.id);
        save();
        setPreview(`${rows.length} rows · ${headers.length} columns imported.`);
      } else {
        const res = await fetch(`/api/google-drive/file/${encodeURIComponent(fileId)}?mode=${contentMode === "text" ? "text" : "metadata"}`);
        const j = await res.json();
        if (!res.ok || !j.connected) throw new Error(j.error ?? "Not connected");
        save();
        setPreview(j.text ? `${String(j.text).slice(0, 140)}…` : `${j.file?.name ?? "File"} (${j.file?.mimeType ?? ""})`);
      }
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <div className="flex items-center gap-2 rounded-lg border border-line bg-black/20 p-2.5 text-[11px] text-ink-faint"><Loader2 size={12} className="animate-spin" /> Checking Drive…</div>;
  }

  if (!status.configured) {
    return (
      <div className="rounded-lg border border-line bg-black/20 p-2.5 text-[11px] leading-relaxed text-ink-faint">
        Google Drive isn&apos;t configured in this deployment. See <code className="font-mono">docs/GOOGLE_DRIVE_CONNECTOR.md</code>.
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="rounded-lg border border-line bg-black/20 p-2.5">
        <p className="text-[11px] leading-relaxed text-ink-dim">Connect Google Drive to use selected files as this source.</p>
        <a href="/api/google/connect" className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-violet/40 bg-violet/[0.1] py-1.5 text-[11px] font-medium text-violet transition hover:bg-violet/[0.18]">
          <Link2 size={12} /> Connect Google Drive
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-black/20 p-2.5 text-[11.5px]">
      <div className="flex items-center gap-1.5 text-ink-dim">
        <Check size={12} className="text-green" /> Connected{status.email ? ` · ${status.email}` : ""}
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">File / Spreadsheet ID</span>
        <input
          value={fileId}
          onChange={(e) => setFileId(e.target.value)}
          placeholder="Drive file id (Picker coming next)"
          className="w-full rounded-md border border-line bg-black/30 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-line-strong"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint">Content</span>
        <select
          value={contentMode}
          onChange={(e) => setContentMode(e.target.value as typeof contentMode)}
          className="w-full rounded-md border border-line bg-black/30 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-line-strong"
        >
          <option value="metadata">Metadata only</option>
          <option value="text">Document text</option>
          <option value="sheet_rows">Sheet rows → dataset</option>
          <option value="file_link">File link only</option>
        </select>
      </label>
      {contentMode === "sheet_rows" && (
        <input
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="Sheet1!A1:Z200"
          className="w-full rounded-md border border-line bg-black/30 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-line-strong"
        />
      )}
      <div className="flex gap-1.5">
        <button onClick={save} className="flex-1 rounded-md border border-line bg-white/[0.03] py-1.5 text-[11px] text-ink-dim transition hover:text-ink">
          Bind file
        </button>
        <button
          onClick={() => void applyDriveAsSource()}
          disabled={busy || !fileId}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-violet/40 bg-violet/[0.1] py-1.5 text-[11px] font-medium text-violet transition hover:bg-violet/[0.18] disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Use as source
        </button>
      </div>
      {preview && <p className={cn("text-[10.5px] leading-relaxed text-ink-faint")}>{preview}</p>}
    </div>
  );
}
