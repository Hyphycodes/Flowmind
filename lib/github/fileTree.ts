import type { RepoStructure } from "./types";

/** File-placement assistant. From a repo's top-level entries (and optionally the full tree)
 *  we guess the framework and suggest where a Flowmind export should live. Basic by design. */

export function detectRepoStructure(
  entries: Array<{ name: string; type: string }>,
  slug: string,
): RepoStructure {
  const names = new Set(entries.map((e) => e.name.toLowerCase()));
  const dirs = entries.filter((e) => e.type === "dir").map((e) => e.name);

  const isNext = names.has("next.config.js") || names.has("next.config.ts") || names.has("next.config.mjs");
  const hasApp = names.has("app");
  const hasSrc = names.has("src");
  const hasPages = names.has("pages");
  const isMonorepo =
    names.has("pnpm-workspace.yaml") || names.has("turbo.json") || names.has("apps") || names.has("packages");
  const isNode = names.has("package.json");

  const safeSlug = slug || "pipeline";
  const suggestions: string[] = [];
  if (isMonorepo) {
    suggestions.push(`packages/flowmind-${safeSlug}`, `apps/flowmind-${safeSlug}`, `flowmind/${safeSlug}`);
  } else if (isNext) {
    if (hasSrc) suggestions.push(`src/ai/${safeSlug}`);
    suggestions.push(`app/api/ai/${safeSlug}`, `lib/flowmind/${safeSlug}`, `flowmind/${safeSlug}`);
  } else if (isNode) {
    suggestions.push(hasSrc ? `src/flowmind/${safeSlug}` : `lib/flowmind/${safeSlug}`, `flowmind/${safeSlug}`);
  } else {
    suggestions.push(`flowmind/${safeSlug}`);
  }

  return {
    isNext,
    isNode,
    isMonorepo,
    hasSrc,
    hasApp,
    hasPages,
    topLevelDirs: dirs,
    suggestions: Array.from(new Set(suggestions)),
  };
}
