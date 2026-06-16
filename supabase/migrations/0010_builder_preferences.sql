-- Flowmind Task 03b: builder preferences (the copilot that remembers).
--
-- Additive + idempotent. Stores learned + explicit build patterns and model defaults so generation
-- and edits nudge toward how this builder already works. No secrets are stored. Transitional RLS
-- mirrors 0007: legacy/demo rows (null user_id) stay accessible; new rows are owner-only. With auth
-- enabled the record is scoped per user; the public demo uses the 'default' singleton.

create table if not exists public.builder_preferences (
  id text primary key default 'default',
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null default 'user',
  patterns jsonb not null default '[]'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builder_preferences enable row level security;

drop policy if exists builder_preferences_owned on public.builder_preferences;
create policy builder_preferences_owned on public.builder_preferences
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
