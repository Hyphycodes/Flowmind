-- Flowmind Prompt 09: user accounts, ownership, connected accounts (Google Drive).
--
-- IMPORTANT: apply this ONLY after enabling Supabase Auth (Google provider) and setting
-- NEXT_PUBLIC_AUTH_ENABLED=true. It is additive + idempotent and uses a TRANSITIONAL RLS
-- policy (`user_id is null OR user_id = auth.uid()`) so existing demo/prototype rows (null
-- user_id) stay readable while new rows become user-owned. Once all data has owners, drop
-- the `user_id is null` allowance for a strict per-user model.
--
-- Tokens (OAuth access/refresh) are stored ENCRYPTED (AES-256-GCM, app-side) and are never
-- selected by the client or exported.

-- ── profiles ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  onboarding_use_case text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── workspaces ────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Workspace',
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
drop policy if exists workspaces_owner on public.workspaces;
create policy workspaces_owner on public.workspaces
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists workspace_members_self on public.workspace_members;
create policy workspace_members_self on public.workspace_members
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── connected_accounts (encrypted OAuth tokens) ───────────────────────
create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_account_id text,
  email text,
  scopes text[],
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  status text not null default 'connected',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.connected_accounts enable row level security;
drop policy if exists connected_accounts_self on public.connected_accounts;
create policy connected_accounts_self on public.connected_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── google_drive_files (selected file metadata) ───────────────────────
create table if not exists public.google_drive_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  connected_account_id uuid references public.connected_accounts(id) on delete cascade,
  google_file_id text not null,
  name text,
  mime_type text,
  web_view_link text,
  icon_link text,
  last_seen_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, google_file_id)
);
alter table public.google_drive_files enable row level security;
drop policy if exists google_drive_files_self on public.google_drive_files;
create policy google_drive_files_self on public.google_drive_files
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── ownership columns on existing data ────────────────────────────────
alter table public.pipelines add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.datasets add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.runs add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.takes add column if not exists user_id uuid references auth.users(id) on delete set null;

do $$ begin
  if to_regclass('public.exports') is not null then
    execute 'alter table public.exports add column if not exists user_id uuid references auth.users(id) on delete set null';
  end if;
end $$;

-- Transitional RLS: legacy/demo rows (null user_id) stay accessible; new rows are owner-only.
-- Templates remain public via is_template = true on pipelines.
drop policy if exists pipelines_all on public.pipelines;
create policy pipelines_owned on public.pipelines
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid() or is_template = true)
  with check (user_id is null or user_id = auth.uid());

drop policy if exists datasets_all on public.datasets;
create policy datasets_owned on public.datasets
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists takes_all on public.takes;
create policy takes_owned on public.takes
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
