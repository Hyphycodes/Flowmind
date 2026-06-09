-- Flowmind initial schema: pipelines + runs.
-- Applied to the "Flowmind" Supabase project. RLS is permissive for the single-user
-- V1 prototype — TIGHTEN these policies when auth is added.

create extension if not exists "pgcrypto";

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled Pipeline',
  description text not null default '',
  graph jsonb not null default '{}'::jsonb,
  is_template boolean not null default false,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade,
  status text not null default 'running',
  input jsonb not null default '{}'::jsonb,
  trace jsonb not null default '[]'::jsonb,
  tables jsonb not null default '[]'::jsonb,
  final_output jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists runs_pipeline_id_idx on public.runs(pipeline_id);
create index if not exists pipelines_updated_at_idx on public.pipelines(updated_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists pipelines_set_updated_at on public.pipelines;
create trigger pipelines_set_updated_at before update on public.pipelines
for each row execute function public.set_updated_at();

-- RLS: permissive single-user V1 -- TIGHTEN when auth is added
alter table public.pipelines enable row level security;
alter table public.runs enable row level security;

drop policy if exists pipelines_all on public.pipelines;
create policy pipelines_all on public.pipelines for all to anon, authenticated using (true) with check (true);

drop policy if exists runs_all on public.runs;
create policy runs_all on public.runs for all to anon, authenticated using (true) with check (true);
