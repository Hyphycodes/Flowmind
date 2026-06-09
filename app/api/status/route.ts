import { DEFAULT_MODEL, hasAnthropicKey } from "@/lib/ai/anthropic";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    anthropic: hasAnthropicKey(),
    model: DEFAULT_MODEL,
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
