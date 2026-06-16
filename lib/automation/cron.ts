/** A small, dependency-free 5-field cron evaluator (minute hour day-of-month month day-of-week).
 *  Used by the schedule worker (cronMatches at each tick) and the UI (preview + next fire). Supports
 *  `*`, numbers, lists `a,b`, ranges `a-b`, and steps `* / n` / `a-b / n`. Timezone-aware via Intl. */

const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type Parts = { minute: number; hour: number; day: number; month: number; dow: number };

function tzParts(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = parseInt(p.hour, 10);
  return {
    minute: parseInt(p.minute, 10),
    hour: hour === 24 ? 0 : hour,
    day: parseInt(p.day, 10),
    month: parseInt(p.month, 10),
    dow: DOW_MAP[p.weekday] ?? 0,
  };
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*" || field === "?") return true;
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10) || 1;
      const [lo, hi] = range === "*" ? [min, max] : range.includes("-") ? range.split("-").map(Number) : [Number(range), max];
      for (let v = lo; v <= hi; v += step) if (v === value) return true;
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) return true;
    } else if (Number(part) === value) {
      return true;
    }
  }
  return false;
}

export function isValidCron(cron: string): boolean {
  return cron.trim().split(/\s+/).length === 5;
}

/** Does `cron` (in `timeZone`) match the given moment, to the minute? */
export function cronMatches(cron: string, date: Date, timeZone = "UTC"): boolean {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return false;
  const [min, hour, dom, mon, dow] = f;
  const p = tzParts(date, timeZone);
  if (!matchField(min, p.minute, 0, 59)) return false;
  if (!matchField(hour, p.hour, 0, 23)) return false;
  if (!matchField(mon, p.month, 1, 12)) return false;
  // Standard cron quirk: when both day-of-month and day-of-week are restricted, fire if EITHER matches.
  const domRestricted = dom !== "*" && dom !== "?";
  const dowRestricted = dow !== "*" && dow !== "?";
  const domOk = matchField(dom, p.day, 1, 31);
  const dowOk = matchField(dow, p.dow, 0, 6);
  if (domRestricted && dowRestricted) return domOk || dowOk;
  return domOk && dowOk;
}

/** The next minute (from `from`) at which the cron fires, or null within the 366-day horizon. */
export function nextFire(cron: string, timeZone = "UTC", from: Date = new Date()): Date | null {
  if (!isValidCron(cron)) return null;
  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  const horizon = 366 * 24 * 60;
  const cursor = start;
  for (let i = 0; i < horizon; i++) {
    if (cronMatches(cron, cursor, timeZone)) return new Date(cursor);
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

const DOW_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A plain-English preview for the common patterns; a generic description otherwise. */
export function cronPreview(cron: string): string {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return "Invalid schedule";
  const [min, hour, dom, mon, dow] = f;
  const at = (h: string, m: string) => {
    const hh = Number(h);
    const mm = Number(m);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const ampm = hh < 12 ? "AM" : "PM";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  };

  if (min === "*" && hour === "*") return "Every minute";
  if (hour === "*" && /^\*\/\d+$/.test(min)) return `Every ${min.slice(2)} minutes`;
  if (/^\d+$/.test(min) && hour === "*") return `Hourly at :${String(Number(min)).padStart(2, "0")}`;

  const time = at(hour, min);
  if (time && dom === "*" && mon === "*" && dow === "*") return `Every day at ${time}`;
  if (time && dom === "*" && mon === "*" && dow === "1-5") return `Every weekday at ${time}`;
  if (time && dom === "*" && mon === "*" && /^\d$/.test(dow)) return `Every ${DOW_NAME[Number(dow)]} at ${time}`;
  if (time && /^\d+$/.test(dom) && mon === "*" && dow === "*") return `Monthly on day ${dom} at ${time}`;
  if (time) return `At ${time} on a custom schedule`;
  return `Custom schedule (${cron})`;
}

/** A few presets for the UI. */
export const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: "Every weekday at 9:00 AM", cron: "0 9 * * 1-5" },
  { label: "Every day at 8:00 AM", cron: "0 8 * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Every Monday at 9:00 AM", cron: "0 9 * * 1" },
  { label: "First of the month at 9:00 AM", cron: "0 9 1 * *" },
];
