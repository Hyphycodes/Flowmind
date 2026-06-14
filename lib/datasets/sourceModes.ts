import type { InputSourceMode } from "@/lib/pipeline/schema";

/** Human labels + badges for Source Modes (shared by the canvas, inspector, library). */
export const SOURCE_MODE_LABEL: Record<InputSourceMode, string> = {
  live_api: "Live API",
  input_studio: "Studio",
  uploaded_file: "Upload",
  manual_table: "Manual",
  previous_take: "Previous Take",
  memory: "Memory",
  webhook: "Webhook",
  database: "Database",
  google_drive: "Google Drive",
  github_repo: "GitHub Repo",
  github_file: "GitHub File",
  github_issues: "GitHub Issues",
  github_pull_requests: "GitHub PRs",
};

export const SOURCE_MODE_OPTIONS: { mode: InputSourceMode; label: string; hint: string }[] = [
  { mode: "input_studio", label: "Input Studio", hint: "Generated, reusable Seed Dataset" },
  { mode: "live_api", label: "Live API", hint: "Real tool / API call at run time" },
  { mode: "google_drive", label: "Google Drive", hint: "Selected Drive files / Docs / Sheets" },
  { mode: "github_repo", label: "GitHub Repo", hint: "A connected repository's file tree" },
  { mode: "github_file", label: "GitHub File", hint: "A specific file from a connected repo" },
  { mode: "github_issues", label: "GitHub Issues", hint: "Issues for triage / release notes" },
  { mode: "github_pull_requests", label: "GitHub PRs", hint: "Pull requests for review / changelog" },
  { mode: "previous_take", label: "Previous Take", hint: "An earlier run's output table" },
  { mode: "uploaded_file", label: "Uploaded File", hint: "A file you bring in" },
  { mode: "manual_table", label: "Manual Table", hint: "Hand-entered rows" },
  { mode: "memory", label: "Memory", hint: "Recalled long-term state" },
  { mode: "webhook", label: "Webhook", hint: "Pushed in from an external event" },
  { mode: "database", label: "Database", hint: "Queried from a table" },
];
