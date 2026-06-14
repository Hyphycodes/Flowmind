-- Flowmind Prompt 11: billing, credits, usage, plans, BYOK keys.
--
-- Apply AFTER auth (0007). Additive + idempotent. Billing is OFF by default
-- (NEXT_PUBLIC_BILLING_ENABLED) so the public demo is unaffected and all helpers degrade
-- gracefully without these tables. Stripe secrets / model keys are NEVER stored here in plain
-- text and NEVER sent to the client: only customer/subscription metadata + encrypted key refs.

-- ── billing_customers (Stripe customer mapping) ───────────────────────
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);
alter table public.billing_customers enable row level security;
drop policy if exists billing_customers_self on public.billing_customers;
create policy billing_customers_self on public.billing_customers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── subscriptions (plan + status synced from Stripe) ──────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  stripe_subscription_id text,
  stripe_customer_id text,
  plan_id text not null default 'free',
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create unique index if not exists subscriptions_stripe_sub_idx on public.subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_self on public.subscriptions;
create policy subscriptions_self on public.subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── credit_events (spend / grant / purchase ledger) ───────────────────
create table if not exists public.credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  pipeline_id text,
  run_id text,
  take_id text,
  event_type text not null,
  credits_delta numeric not null,
  model_cost_estimate jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists credit_events_user_id_idx on public.credit_events(user_id, created_at desc);
alter table public.credit_events enable row level security;
drop policy if exists credit_events_self on public.credit_events;
create policy credit_events_self on public.credit_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── usage_counters (per-period rollups powering the meter + gates) ────
create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  counters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id, period_start)
);
alter table public.usage_counters enable row level security;
drop policy if exists usage_counters_self on public.usage_counters;
create policy usage_counters_self on public.usage_counters
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── usage_events (model/team/agent/export/tool analytics) ─────────────
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  type text not null,
  pipeline_id text,
  node_id text,
  team_id text,
  agent_id text,
  provider_id text,
  model_id text,
  tool_id text,
  credits_used numeric,
  token_usage jsonb,
  cost_estimate jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_id_idx on public.usage_events(user_id, created_at desc);
alter table public.usage_events enable row level security;
drop policy if exists usage_events_self on public.usage_events;
create policy usage_events_self on public.usage_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── user_model_keys (BYOK — encrypted key REFERENCES only, never plaintext) ──
create table if not exists public.user_model_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  provider_id text not null,
  label text not null default 'Key',
  encrypted_key_ref text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_model_keys enable row level security;
drop policy if exists user_model_keys_self on public.user_model_keys;
create policy user_model_keys_self on public.user_model_keys
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
