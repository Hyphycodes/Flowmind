import { getServerSupabaseAuth } from "@/lib/supabase/serverClient";

export type FlowmindUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/** The signed-in user (server-side), or null in demo/unauthenticated mode. Never throws. */
export async function getCurrentUser(): Promise<FlowmindUser | null> {
  try {
    const sb = await getServerSupabaseAuth();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) return null;
    const u = data.user;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    return {
      id: u.id,
      email: u.email ?? null,
      displayName: (meta.full_name as string) ?? (meta.name as string) ?? null,
      avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
    };
  } catch {
    return null;
  }
}

/** Require a signed-in user in a route handler; returns the user or null (caller 401s). */
export async function requireUser(): Promise<FlowmindUser | null> {
  return getCurrentUser();
}
