-- Flowmind Task 06: triggers & automation — pipelines that run themselves.
--
-- Additive + idempotent. Triggers fire the headless run core on a schedule, from a webhook, or
-- after an upstream pipeline completes. Transitional RLS mirrors 0007: owners (and demo null-owned
-- rows) manage their triggers. Webhook-token lookups + the schedule worker run server-side with a
-- trusted client. A `source` column tags how each run started so the activity feed can show it.

create table if not exists public.triggers (
  id text primary key,
  pipeline_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  type text not null,
  name text not null default '',
  schedule jsonb,
  webhook jsonb,
  upstream_pipeline_id text,
  default_inputs jsonb not null default '{}'::jsonb,
  last_fired_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists triggers_pipeline_idx on public.triggers (pipeline_id);
create index if not exists triggers_upstream_idx on public.triggers (upstream_pipeline_id);
create index if not exists triggers_webhook_token_idx on public.triggers ((webhook ->> 'token'));

alter table public.triggers enable row level security;
drop policy if exists triggers_owner on public.triggers;
create policy triggers_owner on public.triggers
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

-- Per-firing record (Task 06b extends this with attempt/error/duration/cost).
create table if not exists public.trigger_runs (
  id text primary key,
  trigger_id text not null,
  run_id text,
  status text,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists trigger_runs_trigger_idx on public.trigger_runs (trigger_id);
alter table public.trigger_runs enable row level security;
drop policy if exists trigger_runs_all on public.trigger_runs;
create policy trigger_runs_all on public.trigger_runs
  for all to anon, authenticated using (true) with check (true);

-- Tag how a run started (manual | schedule | webhook | pipeline).
alter table public.runs add column if not exists source text;
