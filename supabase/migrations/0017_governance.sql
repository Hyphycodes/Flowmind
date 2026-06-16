-- Flowmind Task 07b: audit & governance — the enterprise wedge.
--
-- Additive + idempotent. Builds on Task 07 workspaces. The audit log is append-only and
-- tamper-evident at the RLS level (no update/delete; server-only inserts). Budgets + approval
-- gates are enforced server-side, opt-in per workspace (default off so a solo user isn't slowed).

-- ── audit_log (append-only, admin-readable, server-write-only) ────────────────
create table if not exists public.audit_log (
  id text primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid,
  action text not null,
  target_type text,
  target_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_ws_idx on public.audit_log (workspace_id, created_at desc);
alter table public.audit_log enable row level security;

-- Admins of the workspace may READ. There is intentionally NO insert/update/delete policy for
-- anon/authenticated — only the service-role client (recordAudit) can write, and nobody can edit or
-- delete entries. This is the tamper-evidence boundary.
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select to anon, authenticated
  using (workspace_id is null or public.is_workspace_admin(workspace_id));

-- ── workspace_governance (per-workspace config) ──────────────────────────────
create table if not exists public.workspace_governance (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  audit_enabled boolean not null default true,
  monthly_budget_usd numeric,
  -- which actions require admin approval: deep_run | export | public_link | pricing
  require_approval jsonb not null default '[]'::jsonb,
  approval_cost_threshold_usd numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspace_governance enable row level security;
drop policy if exists workspace_governance_read on public.workspace_governance;
create policy workspace_governance_read on public.workspace_governance for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_governance_admin_write on public.workspace_governance;
create policy workspace_governance_admin_write on public.workspace_governance for all to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- per-member monthly spend cap (optional)
alter table public.workspace_members add column if not exists monthly_budget_usd numeric;

-- ── approval_requests (pending → approved/denied) ────────────────────────────
create table if not exists public.approval_requests (
  id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  requester_user_id uuid,
  action text not null,
  target_id text,
  reason text,
  estimated_cost_usd numeric,
  status text not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists approval_requests_ws_idx on public.approval_requests (workspace_id, status);
alter table public.approval_requests enable row level security;
-- members see their workspace's requests; members create; admins decide.
drop policy if exists approval_requests_read on public.approval_requests;
create policy approval_requests_read on public.approval_requests for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert on public.approval_requests for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
drop policy if exists approval_requests_admin_decide on public.approval_requests;
create policy approval_requests_admin_decide on public.approval_requests for update to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
