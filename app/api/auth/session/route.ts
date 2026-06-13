import { getCurrentUser } from "@/lib/auth/user";
import { authEnabled } from "@/lib/auth/config";

export const runtime = "nodejs";

/** Sanitized current-user info for client UI. Never returns tokens. */
export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ authEnabled: authEnabled(), user });
}
