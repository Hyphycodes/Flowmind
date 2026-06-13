/** Export system types (Prompt 07). Manifests are generated, not parsed back, so these
 *  are plain TS types; the health check + manifest persist as jsonb. */

export const EXPORT_MODES = ["developer", "client_blueprint", "founder_brief", "runtime", "api"] as const;
export type ExportMode = (typeof EXPORT_MODES)[number];

export const EXPORT_MODE_META: Record<ExportMode, { label: string; audience: string; description: string }> = {
  developer: {
    label: "Developer Package",
    audience: "builders",
    description: "Machine-readable config, schemas, agents, crews, tools, datasets, traces + runnable example.",
  },
  client_blueprint: {
    label: "Client Blueprint",
    audience: "agencies / clients",
    description: "A polished, sell-ready overview: what it does, team map, data, integrations, phases.",
  },
  founder_brief: {
    label: "Founder Brief",
    audience: "founders",
    description: "Is it worth building? MVP scope, monetization, fastest test, complexity, launch path.",
  },
  runtime: {
    label: "Runtime Package",
    audience: "integrators",
    description: "run-pipeline.ts + a portable runtime, typed schemas, tool/model adapter stubs, example I/O.",
  },
  api: {
    label: "Hosted API",
    audience: "integrators",
    description: "API docs for POST /api/pipelines/{id}/run — request/response, env, curl + fetch examples.",
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
