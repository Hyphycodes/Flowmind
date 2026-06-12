-- Flowmind upgrade: first-class objects for complex AI systems.
-- Datasets (Input Studio / Dataset Library), Takes (run variations), pipeline
-- versions, and registries for custom tools + model configs.
-- Product Drops, Reality Meters, Handoff Packets, Output Tables, and UI Bindings
-- live inside the pipeline graph / run trace jsonb, so they need no extra tables.
-- RLS is permissive for the single-user V1 prototype — TIGHTEN when auth is added.

create table if not exists public.datasets (
  id text primary key,
  name text not null default 'Dataset',
  description text not null default '',
  mode text not null default 'input_studio',
  schema jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  source_prompt text,
  version int not null default 1,
  quality_score numeric,
  connected_pipelines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.takes (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade,
  name text not null default 'Take',
  trace jsonb,
  model_selections jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  cost_usd numeric,
  latency_ms int,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists takes_pipeline_id_idx on public.takes(pipeline_id);

create table if not exists public.pipeline_versions (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade,
  version int not null default 1,
  graph jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pipeline_versions_pipeline_id_idx on public.pipeline_versions(pipeline_id);

create table if not exists public.tools (
  id text primary key,
  name text not null default 'Tool',
  category text,
  definition jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_configs (
  id text primary key,
  provider text,
  definition jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

drop trigger if exists datasets_set_updated_at on public.datasets;
create trigger datasets_set_updated_at before update on public.datasets
for each row execute function public.set_updated_at();

drop trigger if exists tools_set_updated_at on public.tools;
create trigger tools_set_updated_at before update on public.tools
for each row execute function public.set_updated_at();

alter table public.datasets enable row level security;
alter table public.takes enable row level security;
alter table public.pipeline_versions enable row level security;
alter table public.tools enable row level security;
alter table public.model_configs enable row level security;

drop policy if exists datasets_all on public.datasets;
create policy datasets_all on public.datasets for all to anon, authenticated using (true) with check (true);
drop policy if exists takes_all on public.takes;
create policy takes_all on public.takes for all to anon, authenticated using (true) with check (true);
drop policy if exists pipeline_versions_all on public.pipeline_versions;
create policy pipeline_versions_all on public.pipeline_versions for all to anon, authenticated using (true) with check (true);
drop policy if exists tools_all on public.tools;
create policy tools_all on public.tools for all to anon, authenticated using (true) with check (true);
drop policy if exists model_configs_all on public.model_configs;
create policy model_configs_all on public.model_configs for all to anon, authenticated using (true) with check (true);
