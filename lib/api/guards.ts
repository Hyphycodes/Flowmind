import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser, type FlowmindUser } from "@/lib/auth/user";
import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";
import { redactSecrets } from "@/lib/security/secrets";

/** Shared API-route guards (Prompt 12 hardening). Centralizes auth/session, body validation, and
 *  safe error reporting so guard logic isn't duplicated — and so secrets never leak in errors. */

/** A small JSON error helper with a consistent shape. */
export function jsonError(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return Response.json({ error: redactSecrets(message), ...extra }, { status });
}

/** Turn any thrown value into a safe, redacted message (never leaks stack traces / secrets). */
export function safeApiError(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error) return redactSecrets(err.message) || fallback;
  if (typeof err === "string") return redactSecrets(err) || fallback;
  return fallback;
}

export type AuthedContext = { user: FlowmindUser; sb: SupabaseClient };

/** Require a signed-in user + a server Supabase client. Returns `{ user, sb }` or a 401 Response. */
export async function requireUser(): Promise<AuthedContext | Response> {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const sb = await getServerSupabaseAuth();
  if (!sb) return jsonError("Sign in required.", 401);
  return { user, sb };
}

/**
 * Auth + rate-limit guard for token-spending AI routes (Prompt 10). One call per route: rejects
 * anonymous requests with 401, then applies the per-user sliding-window rate limit (429 on
 * exceed). Returns `{ user, sb }` on success or a Response to return immediately. This is the
 * single composed guard every provider-calling route should use at the top of its handler.
 */
export async function requireAuthedAI(): Promise<AuthedContext | Response> {
  const auth = await requireUser();
  if (isGuardResponse(auth)) return auth;
  // Lazy import keeps the Upstash SDK out of routes that don't spend tokens.
  const { enforceRateLimit } = await import("./rateLimit");
  const limited = await enforceRateLimit(auth.user.id);
  if (isGuardResponse(limited)) return limited;
  return auth;
}

/** Validate a request body against a Zod schema. Returns parsed data or a 400 Response. */
export async function validateJsonBody<T>(req: Request, schema: z.ZodSchema<T>): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Request validation failed.", 400, { details: parsed.error.flatten() });
  }
  return parsed.data;
}

/** True when `value` is a Response (used to short-circuit after a guard). */
export function isGuardResponse(value: unknown): value is Response {
  return value instanceof Response;
}

/** Confirm a pipeline is readable by the current session (RLS-enforced). Returns the row's owner
 *  id or a Response. A null owner = legacy/demo pipeline (readable); a template is readable. */
export async function requirePipelineAccess(
  sb: SupabaseClient,
  pipelineId: string,
): Promise<{ ownerId: string | null } | Response> {
  const { data, error } = await sb.from("pipelines").select("id,user_id").eq("id", pipelineId).maybeSingle();
  if (error) return jsonError("Could not verify pipeline access.", 403);
  if (!data) return jsonError("Pipeline not found.", 404);
  return { ownerId: (data as { user_id: string | null }).user_id ?? null };
}
