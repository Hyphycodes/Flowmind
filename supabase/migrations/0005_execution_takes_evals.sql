-- Flowmind Prompt 05: execution Takes + eval scores.
-- Adds Prompt-05 columns to `takes` (mode, status, eval results, score, warnings) and an
-- `eval_scores` table for per-dimension judge scores. Run traces (steps, team/agent traces,
-- tool traces, handoff packets, eval results) live inside the `runs.trace` + `takes.trace`
-- jsonb, so they need no extra tables. Additive + idempotent; saveTake falls back to the
-- base columns if these aren't applied yet. RLS stays permissive for the prototype — TIGHTEN
-- when auth lands.

alter table public.takes
  add column if not exists description text,
  add column if not exists mode text,
  add column if not exists status text,
  add column if not exists run_trace_id text,
  add column if not exists eval_results jsonb not null default '[]'::jsonb,
  add column if not exists overall_score numeric,
  add column if not exists warning_count int;

create table if not exists public.eval_scores (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid,
  run_id text,
  take_id text,
  node_id text,
  agent_id text,
  dimension text not null,
  score numeric not null,
  label text,
  explanation text,
  warnings jsonb,
  created_at timestamptz not null default now()
);
create index if not exists eval_scores_take_id_idx on public.eval_scores(take_id);
create index if not exists eval_scores_pipeline_id_idx on public.eval_scores(pipeline_id);

alter table public.eval_scores enable row level security;
drop policy if exists eval_scores_all on public.eval_scores;
create policy eval_scores_all on public.eval_scores
  for all to anon, authenticated using (true) with check (true);
