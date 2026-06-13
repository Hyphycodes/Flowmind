-- Flowmind Prompt 07: export history (manifest + health check only — never the ZIP bytes).
-- Additive + idempotent; saveExport is best-effort and the app works without this table.
-- RLS stays permissive for the prototype — TIGHTEN when auth lands.

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  pipeline_id text,
  mode text[] not null default '{}',
  manifest jsonb not null default '{}'::jsonb,
  health_check jsonb,
  created_at timestamptz not null default now()
);
create index if not exists exports_pipeline_id_idx on public.exports(pipeline_id);

alter table public.exports enable row level security;
drop policy if exists exports_all on public.exports;
create policy exports_all on public.exports
  for all to anon, authenticated using (true) with check (true);
