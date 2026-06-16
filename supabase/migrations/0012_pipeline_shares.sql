-- Flowmind Task 05: pipeline shares (View / Run / Edit) + hosted Run-Apps.
--
-- Additive + idempotent. The share record IS the security boundary together with RLS — permission
-- is never trusted from the client. Transitional RLS mirrors 0007: owners (and demo null-owned
-- rows) manage their shares; authed recipients may READ a share granted to their email. Link-token
-- reads are performed server-side with a trusted client (service role when configured, else the
-- anon client which can only read null-owned demo rows). The link_token is an unguessable secret.

create table if not exists public.pipeline_shares (
  id text primary key,
  pipeline_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  level text not null default 'run',
  recipients jsonb not null default '[]'::jsonb,
  link_enabled boolean not null default false,
  link_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pipeline_shares_pipeline_idx on public.pipeline_shares (pipeline_id);
create index if not exists pipeline_shares_token_idx on public.pipeline_shares (link_token);

alter table public.pipeline_shares enable row level security;

-- Owners manage their own shares (+ demo null-owned rows).
drop policy if exists pipeline_shares_owner on public.pipeline_shares;
create policy pipeline_shares_owner on public.pipeline_shares
  for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

-- Authed recipients may READ (only) a share granted to their email.
drop policy if exists pipeline_shares_recipient_read on public.pipeline_shares;
create policy pipeline_shares_recipient_read on public.pipeline_shares
  for select to authenticated
  using (
    exists (
      select 1 from jsonb_array_elements(recipients) as r
      where r->>'email' = (auth.jwt() ->> 'email')
    )
  );
