-- Flowmind Task 04: Living Library — reusable assets (nodes, prompts, tool configs, dataset refs).
--
-- Additive + idempotent. Mirrors the datasets table + transitional RLS from 0007: legacy/demo rows
-- (null user_id) stay accessible; new rows are owner-only once auth is enabled. No secrets stored
-- (tool configs hold references/options, never credentials).

create table if not exists public.library_assets (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  name text not null default 'Untitled',
  description text,
  payload jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.library_assets enable row level security;

drop policy if exists library_assets_owned on public.library_assets;
create policy library_assets_owned on public.library_assets
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
