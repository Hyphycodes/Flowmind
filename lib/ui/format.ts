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
