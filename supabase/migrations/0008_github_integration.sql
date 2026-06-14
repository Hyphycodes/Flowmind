-- Flowmind Prompt 10: GitHub integration (repo connection, repo export, PR/issue history).
--
-- Apply this AFTER auth is enabled (migration 0007). Additive + idempotent. Connection rows
-- store METADATA ONLY — no GitHub tokens are persisted: installation access tokens are minted
-- on demand from the GitHub App private key + installation_id, used server-side, and discarded.
-- Nothing here is ever exported or sent to the client.

-- ── github_connections (installation metadata — NO tokens) ─────────────
create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider text not null default 'github',
  github_user_id text,
  username text,
  avatar_url text,
  installation_id text,
  account_type text,
  account_login text,
  permissions jsonb,
  selected_repositories jsonb,
  status text not null default 'connected',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.github_connections enable row level security;
drop policy if exists github_connections_self on public.github_connections;
create policy github_connections_self on public.github_connections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── github_exports (branch / commit / PR history) ─────────────────────
create table if not exists public.github_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  pipeline_id text,
  export_id text,
  repository_full_name text not null,
  branch_name text not null,
  base_branch text,
  destination_path text,
  commit_sha text,
  pull_request_number int,
  pull_request_url text,
  files_changed jsonb,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists github_exports_pipeline_id_idx on public.github_exports(pipeline_id);
alter table public.github_exports enable row level security;
drop policy if exists github_exports_self on public.github_exports;
create policy github_exports_self on public.github_exports
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── github_repo_cache (repo + file-tree snapshots) ────────────────────
create table if not exists public.github_repo_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  connection_id uuid references public.github_connections(id) on delete cascade,
  repository_full_name text not null,
  repository jsonb not null,
  file_tree jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, repository_full_name)
);
alter table public.github_repo_cache enable row level security;
drop policy if exists github_repo_cache_self on public.github_repo_cache;
create policy github_repo_cache_self on public.github_repo_cache
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
