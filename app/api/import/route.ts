import { z } from "zod";
import { importCodebase, type SourceFile } from "@/lib/import";
import { importIRSchema } from "@/lib/import/ir";
import { irToPipeline } from "@/lib/import/toPipeline";
import { fetchGithubRepo } from "@/lib/import/github";
import { requireUser, validateJsonBody, safeApiError, isGuardResponse } from "@/lib/api/guards";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Import a folder/repo into a visual pipeline (Prompt 21). Server-side, auth-required. Runs STATIC
 * analysis only — the uploaded code is never sent to an AI model (that would be a separate, disclosed
 * opt-in). Returns the IR + report + a candidate pipeline for the client's review step. We never
 * echo file contents back, and the analyzer ignores secrets (it extracts structure, not values).
 */

// Phases: (1a) `repoUrl` → fetch a public repo's files server-side, then detect; (1b) `files` →
// detect uploaded files into IR + render a candidate; (2) `ir` → re-render after the user's review
// corrections (rename / exclude). One endpoint, any of these bodies.
const bodySchema = z.object({
  name: z.string().optional(),
  repoUrl: z.string().max(300).optional(),
  files: z.array(z.object({ path: z.string(), content: z.string() })).max(2000).optional(),
  ir: importIRSchema.optional(),
});

export async function POST(req: Request) {
  // Auth required (login ≠ repo access; this only reads files the user uploaded in this request).
  const auth = await requireUser();
  if (isGuardResponse(auth)) return auth;

  const parsed = await validateJsonBody(req, bodySchema);
  if (isGuardResponse(parsed)) return parsed;

  try {
    // Phase 2 — finalize from the reviewed IR (re-parse to apply schema defaults).
    if (parsed.ir) {
      const ir = importIRSchema.parse(parsed.ir);
      const pipeline = irToPipeline(ir, parsed.name || "Imported System");
      return Response.json({ pipeline });
    }
    // Phase 1a — fetch a public GitHub repo server-side (read-only), then analyze statically.
    if (parsed.repoUrl) {
      const { name, files } = await fetchGithubRepo(parsed.repoUrl);
      const { ir, report, pipeline } = importCodebase(files, parsed.name || name);
      return Response.json({ report, ir, pipeline });
    }
    // Phase 1b — detect from uploaded files.
    if (!parsed.files || parsed.files.length === 0) {
      return Response.json({ error: "Paste a repo URL or upload at least one source file." }, { status: 400 });
    }
    const files: SourceFile[] = parsed.files.map((f) => ({ path: f.path, content: f.content }));
    const { ir, report, pipeline } = importCodebase(files, parsed.name);
    // IR carries only structure (names, models, prompts, source refs) — no raw file bodies.
    return Response.json({ report, ir, pipeline });
  } catch (err) {
    return Response.json({ error: safeApiError(err, "Import failed.") }, { status: 500 });
  }
}
