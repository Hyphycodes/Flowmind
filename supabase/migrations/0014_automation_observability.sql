-- Flowmind Task 06b: automation observability — trust your unattended runs.
--
-- Additive + idempotent. Adds retry config + bounded retry state + alert config to triggers, and
-- rich per-firing detail to trigger_runs (duration, cost, error, attempt) for the health view.

alter table public.triggers add column if not exists retry jsonb;
alter table public.triggers add column if not exists alerts jsonb;
alter table public.triggers add column if not exists retry_attempt integer not null default 0;
alter table public.triggers add column if not exists next_retry_at timestamptz;
alter table public.triggers add column if not exists last_error text;
alter table public.triggers add column if not exists alerted_failure boolean not null default false;
create index if not exists triggers_next_retry_idx on public.triggers (next_retry_at);

alter table public.trigger_runs add column if not exists started_at timestamptz;
alter table public.trigger_runs add column if not exists finished_at timestamptz;
alter table public.trigger_runs add column if not exists duration_ms integer;
alter table public.trigger_runs add column if not exists cost_usd numeric;
alter table public.trigger_runs add column if not exists error text;
alter table public.trigger_runs add column if not exists attempt integer not null default 1;
