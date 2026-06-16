-- Flowmind Task 05b: Run-App analytics + monetization.
--
-- Additive + idempotent. Pricing lives on the share; usage is recorded in share_runs (analytics);
-- entitlements gate priced runs and are **only writable by the trusted server** (Stripe webhook via
-- service role) — a client must never be able to forge an entitlement and bypass the paywall.

alter table public.pipeline_shares add column if not exists pricing jsonb;

-- ── share_runs (analytics — hashed requester refs, no raw PII) ────────────────
create table if not exists public.share_runs (
  id text primary key,
  share_id text not null,
  requester_ref text,
  status text,
  duration_ms integer,
  cost_usd numeric,
  input_keys text[] not null default '{}',
  run_id text,
  created_at timestamptz not null default now()
);
create index if not exists share_runs_share_idx on public.share_runs (share_id);
alter table public.share_runs enable row level security;

-- Owner (of the parent share) can read analytics; demo null-owned shares stay readable.
drop policy if exists share_runs_owner_read on public.share_runs;
create policy share_runs_owner_read on public.share_runs for select to anon, authenticated
  using (exists (select 1 from public.pipeline_shares s where s.id = share_id and (s.user_id is null or s.user_id = auth.uid())));
-- Low-sensitivity analytics may be recorded by the run path (anon in demo; service role in prod).
drop policy if exists share_runs_insert on public.share_runs;
create policy share_runs_insert on public.share_runs for insert to anon, authenticated with check (true);

-- ── share_entitlements (security boundary — server-write only) ────────────────
create table if not exists public.share_entitlements (
  id text primary key,
  share_id text not null,
  requester_ref text not null,
  kind text not null,
  runs_remaining integer,
  active_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_entitlements_lookup_idx on public.share_entitlements (share_id, requester_ref);
alter table public.share_entitlements enable row level security;

-- Owner can read entitlements for their shares; NO anon/authenticated WRITE policy exists, so only
-- the service-role client (Stripe webhook) can create/decrement them. This is the paywall boundary.
drop policy if exists share_entitlements_owner_read on public.share_entitlements;
create policy share_entitlements_owner_read on public.share_entitlements for select to anon, authenticated
  using (exists (select 1 from public.pipeline_shares s where s.id = share_id and (s.user_id is null or s.user_id = auth.uid())));
