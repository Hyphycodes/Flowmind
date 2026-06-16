export function formatCell(value: unknown, type?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "currency") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : `$${n.toLocaleString()}`;
  }
  if (type === "percent") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : `${n}%`;
  }
  if (type === "number") {
    const n = Number(value);
    return Number.isNaN(n) ? String(value) : n.toLocaleString();
  }
  return String(value);
}

/** "820ms", "1.2s", "34s" — compact run durations for the trace overlay + timeline. */
export function formatDuration(ms?: number | null): string {
  if (ms == null || ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
}

/** "$0.0042", "$0.41", "$1.20" — run cost, with enough precision to be honest at small numbers. */
export function formatUsd(usd?: number | null): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
