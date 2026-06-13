/** Google Drive + Sheets REST helpers (server-only). All take a fresh access token. */

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
};

const FILE_FIELDS = "id,name,mimeType,webViewLink,iconLink,modifiedTime";

export async function listFiles(
  accessToken: string,
  opts: { q?: string; pageSize?: number } = {},
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    pageSize: String(opts.pageSize ?? 25),
    fields: `files(${FILE_FIELDS})`,
    orderBy: "modifiedTime desc",
  });
  if (opts.q) params.set("q", opts.q);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const j = (await res.json()) as { files?: DriveFile[] };
  return j.files ?? [];
}

export async function getFileMeta(accessToken: string, fileId: string): Promise<DriveFile> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${FILE_FIELDS}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Drive meta failed: ${res.status}`);
  return res.json();
}

/** Export a Google Doc as plain text. */
export async function exportDocText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Doc export failed: ${res.status}`);
  return res.text();
}

/** Download a non-Google file's content as text. */
export async function getFileText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`File content failed: ${res.status}`);
  return res.text();
}

export type SheetReadResult = { headers: string[]; rows: Record<string, string>[] };

/** Read a range from a Google Sheet → headers + row objects. */
export async function readSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<SheetReadResult> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Sheet read failed: ${res.status}`);
  const j = (await res.json()) as { values?: string[][] };
  const values = j.values ?? [];
  if (values.length === 0) return { headers: [], rows: [] };
  const headers = values[0].map((h, i) => h || `col_${i + 1}`);
  const rows = values.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
  return { headers, rows };
}
