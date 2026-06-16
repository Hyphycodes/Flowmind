import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Server-only loader for the canonical Flowmind system prompts in `flowmind-prompts/`.
 *  These power the AI routes (architect / editor / trace-explainer / model-picker).
 *  Read once, cached. NEVER import this into client code — it touches the filesystem.
 *
 *  Callers must degrade gracefully if a prompt can't be loaded (e.g. fall back to a
 *  template or a clear "AI key required" error). next.config.ts traces these files into
 *  the relevant serverless bundles via `outputFileTracingIncludes`. */

export type PromptName =
  | "01-architect"
  | "02-editor"
  | "07-trace-explainer"
  | "08-model-picker";

const cache = new Map<PromptName, string>();

export function loadPrompt(name: PromptName): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const text = readFileSync(join(process.cwd(), "flowmind-prompts", `${name}.md`), "utf8");
  cache.set(name, text);
  return text;
}

/** Like `loadPrompt` but returns `null` instead of throwing when the file is missing,
 *  so a route can fall back cleanly rather than 500. */
export function tryLoadPrompt(name: PromptName): string | null {
  try {
    return loadPrompt(name);
  } catch {
    return null;
  }
}
