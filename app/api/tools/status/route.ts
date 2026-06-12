import { toolStatuses } from "@/lib/tools/status";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ tools: toolStatuses() });
}
