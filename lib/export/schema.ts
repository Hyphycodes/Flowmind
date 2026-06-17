/** Export system types (Prompt 07). Manifests are generated, not parsed back, so these
 *  are plain TS types; the health check + manifest persist as jsonb. */

export const EXPORT_MODES = ["developer", "client_blueprint", "founder_brief", "runtime", "api"] as const;
export type ExportMode = (typeof EXPORT_MODES)[number];

/** The three audience-matched tiers shown in the export drawer (Prompt 22). `runtime`/`api` remain
 *  in EXPORT_MODES for back-compat with the health check, but are no longer user-facing options. */
export const EXPORT_TIERS: ExportMode[] = ["developer", "founder_brief", "client_blueprint"];

export const EXPORT_MODE_META: Record<ExportMode, { label: string; audience: string; description: string }> = {
  developer: {
    label: "Developer bundle",
    audience: "developers",
    description: "A self-contained, runnable package: one entry point (runPipeline), package.json, README, and your agents/prompts. Drop it into a repo and run.",
  },
  client_blueprint: {
    label: "Client blueprint",
    audience: "clients",
    description: "A visual, non-technical overview of the system — what it does, step by step, and what you get. No prompts or model details.",
  },
  founder_brief: {
    label: "Founder brief (PDF)",
    audience: "founders",
    description: "A print-ready PDF: architecture diagram, each node's purpose in plain English, and the prompt strategy. Hand it to a developer.",
  },
  runtime: {
    label: "Runtime Package",
    audience: "integrators",
    description: "Folded into the Developer bundle.",
  },
  api: {
    label: "Hosted API",
    audience: "integrators",
    description: "API docs for the hosted run endpoint.",
  },
};

export type HealthCategory =
  | "pipeline"
  | "schema"
  | "agents"
  | "crews"
  | "tools"
  | "datasets"
  | "models"
  | "ui"
  | "runtime"
  | "docs"
  | "env";

export type ExportHealthStatus = "pass" | "warning" | "fail" | "skipped";

export type ExportHealthCheckItem = {
  id: string;
  label: string;
  status: ExportHealthStatus;
  message?: string;
  category: HealthCategory;
};

export type ExportHealthCheck = {
  id: string;
  pipelineId: string;
  status: "ready" | "warning" | "blocked";
  score: number; // 0-100
  checks: ExportHealthCheckItem[];
  missingItems: string[];
  warnings: string[];
  generatedAt: string;
};

export type ExportFileType = "json" | "markdown" | "typescript" | "text";

export type ExportManifestFile = {
  path: string;
  type: ExportFileType;
  description?: string;
};

export type ExportManifest = {
  exportId: string;
  pipelineId: string;
  pipelineName: string;
  exportedAt: string;
  exportModes: ExportMode[];
  fileCount: number;
  files: ExportManifestFile[];
  healthCheck: ExportHealthCheck;
};
