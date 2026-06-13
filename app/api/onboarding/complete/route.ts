import { getCurrentUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

/** Mark onboarding complete for the signed-in user (best-effort; demo mode is a no-op). */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body ok */
  }

  const user = await getCurrentUser();
  if (user) {
    const sb = await getServerSupabaseAuth();
    if (sb) {
      try {
        await sb
          .from("profiles")
          .update({
            onboarding_completed: true,
            onboarding_use_case: typeof body.useCase === "string" ? body.useCase : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      } catch {
        /* columns optional until migration applied */
      }
    }
  }
  return Response.json({ ok: true });
}
