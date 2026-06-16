import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { jsonError } from "./guards";

/**
 * Rate limiting for token-spending AI endpoints (Prompt 10).
 *
 * Server-only. Reads `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` and applies a
 * sliding-window limit keyed per authenticated user (never IP). Two ceilings — a per-minute
 * burst limit and a per-day ceiling — both env-configurable so they can be tuned without a
 * redeploy:
 *   - `RATELIMIT_PER_MINUTE` (default 20)
 *   - `RATELIMIT_PER_DAY`    (default 500)
 *
 * Failure policy (deliberate):
 *   - Redis NOT configured (env missing) → rate limiting is OFF; requests pass. This keeps local
 *     dev and the unconfigured demo working. Auth still gates these routes.
 *   - Redis configured but UNREACHABLE at request time → FAIL CLOSED (deny with 429). For
 *     token-spending AI routes a brief denial is safer than leaving the provider key open to
 *     abuse during a Redis outage.
 */

const PER_MINUTE = Number(process.env.RATELIMIT_PER_MINUTE ?? 20);
const PER_DAY = Number(process.env.RATELIMIT_PER_DAY ?? 500);

function redisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let _minute: Ratelimit | null = null;
let _day: Ratelimit | null = null;

function limiters(): { minute: Ratelimit; day: Ratelimit } | null {
  if (!redisConfigured()) return null;
  if (!_minute || !_day) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    _minute = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PER_MINUTE, "60 s"),
      prefix: "flowmind:rl:min",
      analytics: false,
    });
    _day = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PER_DAY, "86400 s"),
      prefix: "flowmind:rl:day",
      analytics: false,
    });
  }
  return { minute: _minute, day: _day };
}

export type RateLimitOk = { ok: true };

/**
 * Enforce the per-minute and per-day windows for `identifier` (a stable user id). Returns
 * `{ ok: true }` when allowed, or a 429 `Response` when the limit is hit / Redis is down.
 * A single allowed action decrements each window exactly once (no double counting).
 */
export async function enforceRateLimit(identifier: string): Promise<RateLimitOk | Response> {
  const rl = limiters();
  if (!rl) return { ok: true }; // not configured → off

  try {
    // Check the short window first (cheaper to reject bursts), then the daily ceiling.
    const minute = await rl.minute.limit(identifier);
    if (!minute.success) {
      return rateLimited(minute.reset);
    }
    const day = await rl.day.limit(identifier);
    if (!day.success) {
      return rateLimited(day.reset);
    }
    return { ok: true };
  } catch {
    // Configured but unreachable → fail closed.
    return jsonError("Rate limiter unavailable, please retry shortly.", 429, { error: "rate_limited" });
  }
}

function rateLimited(resetEpochMs: number): Response {
  const retryAfter = Math.max(1, Math.ceil((resetEpochMs - Date.now()) / 1000));
  return Response.json(
    { error: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
