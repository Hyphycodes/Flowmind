import { processDueTriggers } from "@/lib/automation/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

/** The cron tick (Task 06). Vercel Cron (vercel.json) hits this every minute; it pops due schedule
 *  triggers and runs them headless. Protected by CRON_SECRET when configured (Vercel Cron sends it
 *  as a Bearer token); open in local/demo when no secret is set. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processDueTriggers();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error)?.message ?? "tick failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
