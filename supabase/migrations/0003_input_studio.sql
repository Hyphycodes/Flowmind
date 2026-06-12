-- Flowmind Input Studio: dataset metadata + dataset versions.
-- Source configs, data contracts, field mappings, and scenario sets persist inside
-- the pipeline `graph` jsonb (nodes carry `source`, edges carry `contract`, the pipeline
-- carries `fieldMappings` + `scenarioSets`), so they need no extra tables. This migration
-- only adds dataset-level Input Studio metadata + an optional version history.
-- Additive + idempotent; existing datasets keep working (saveDataset falls back if `meta`
-- is absent). RLS stays permissive for the single-user prototype — TIGHTEN when auth lands.

alter table public.datasets
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Optional snapshot history so a dataset can be versioned over time.
create table if not exists public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id text references public.datasets(id) on delete cascade,
  version int not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dataset_versions_dataset_id_idx on public.dataset_versions(dataset_id);

alter table public.dataset_versions enable row level security;
drop policy if exists dataset_versions_all on public.dataset_versions;
create policy dataset_versions_all on public.dataset_versions
  for all to anon, authenticated using (true) with check (true);
