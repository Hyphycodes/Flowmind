import { generateInputDataset } from "@/lib/datasets/inputStudio";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as any;
  const prompt = typeof b?.prompt === "string" ? b.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: "Provide a prompt describing the dataset to generate." }, { status: 400 });
  }
  try {
    const dataset = await generateInputDataset({
      name: b?.name,
      prompt,
      columns: Array.isArray(b?.columns) ? b.columns : undefined,
      rowCount: typeof b?.rowCount === "number" ? b.rowCount : undefined,
    });
    return Response.json({ dataset });
  } catch (err) {
    return Response.json({ error: (err as Error)?.message ?? "Generation failed" }, { status: 500 });
  }
}
