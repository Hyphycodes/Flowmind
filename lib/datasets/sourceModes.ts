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
};

export const SOURCE_MODE_OPTIONS: { mode: InputSourceMode; label: string; hint: string }[] = [
  { mode: "input_studio", label: "Input Studio", hint: "Generated, reusable Seed Dataset" },
  { mode: "live_api", label: "Live API", hint: "Real tool / API call at run time" },
  { mode: "previous_take", label: "Previous Take", hint: "An earlier run's output table" },
  { mode: "uploaded_file", label: "Uploaded File", hint: "A file you bring in" },
  { mode: "manual_table", label: "Manual Table", hint: "Hand-entered rows" },
  { mode: "memory", label: "Memory", hint: "Recalled long-term state" },
  { mode: "webhook", label: "Webhook", hint: "Pushed in from an external event" },
  { mode: "database", label: "Database", hint: "Queried from a table" },
];
