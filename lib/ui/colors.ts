/** Node accent color system. Each node carries an accent name (`node.color`);
 *  falls back to a per-type default. */

export type Accent =
  | "violet"
  | "blue"
  | "cyan"
  | "teal"
  | "green"
  | "gold"
  | "orange"
  | "pink"
  | "red"
  | "slate";

export const ACCENT_HEX: Record<Accent, string> = {
  violet: "#8b5cf6",
  blue: "#4f8bff",
  cyan: "#22d3ee",
  teal: "#2dd4bf",
  green: "#34d399",
  gold: "#f5c451",
  orange: "#fb923c",
  pink: "#ec4899",
  red: "#f87171",
  slate: "#94a3b8",
};

export const ACCENTS = Object.keys(ACCENT_HEX) as Accent[];

export function isAccent(x: unknown): x is Accent {
  return typeof x === "string" && x in ACCENT_HEX;
}

const TYPE_ACCENT: Record<string, Accent> = {
  input: "blue",
  agent: "violet",
  tool: "cyan",
  transformer: "teal",
  evaluator: "gold",
  output: "pink",
};

export function accentFor(opts: { color?: string | null; type?: string }): Accent {
  if (isAccent(opts.color)) return opts.color;
  if (opts.type && TYPE_ACCENT[opts.type]) return TYPE_ACCENT[opts.type];
  return "violet";
}

export function hexFor(opts: { color?: string | null; type?: string }): string {
  return ACCENT_HEX[accentFor(opts)];
}

/** rgba() string from a #rrggbb hex + alpha (0..1). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
