-- Flowmind Task 07: workspaces as the unit of ownership + membership-based RLS.
--
-- IMPORTANT: apply ONLY after enabling auth (like 0007). Additive + idempotent + REVERSIBLE
-- (see 0015_workspaces_down.sql). Access moves from "owner == auth.uid()" to "caller is an active
-- member of the record's workspace, at sufficient role". The transitional null-workspace allowance
-- keeps the public demo working (null-workspace rows stay accessible) — drop it once all data has a
-- workspace for strict multi-tenancy.
--
-- Tenant isolation is the whole point. Verify after applying with the queries in
-- docs/WORKSPACES.md ("a user in workspace A cannot read any record of workspace B").

-- ── workspace_members: roles + invite status ─────────────────────────────────
alter table public.workspace_members add column if not exists status text not null default 'active';
alter table public.workspace_members add column if not exists invited_email text;
alter table public.workspaces add column if not exists plan text;

-- ── membership helper functions (SECURITY DEFINER → bypass RLS, no recursion) ──
create or replace function public.is_workspace_member(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.workspace_role(ws uuid) returns text
language sql security definer stable set search_path = public as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

create or replace function public.is_workspace_editor(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.workspace_role(ws) in ('owner','admin','member');
$$;

create or replace function public.is_workspace_admin(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select public.workspace_role(ws) in ('owner','admin');
$$;

-- ── workspace_id on every ownable table ──────────────────────────────────────
alter table public.pipelines add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.datasets  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.runs      add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.takes     add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
do $$ begin
  if to_regclass('public.pipeline_shares') is not null then execute 'alter table public.pipeline_shares add column if not exists workspace_id uuid references public.workspaces(id) on delete set null'; end if;
  if to_regclass('public.library_assets') is not null then execute 'alter table public.library_assets add column if not exists workspace_id uuid references public.workspaces(id) on delete set null'; end if;
  if to_regclass('public.triggers') is not null then execute 'alter table public.triggers add column if not exists workspace_id uuid references public.workspaces(id) on delete set null'; end if;
  if to_regclass('public.exports') is not null then execute 'alter table public.exports add column if not exists workspace_id uuid references public.workspaces(id) on delete set null'; end if;
end $$;
create index if not exists pipelines_ws_idx on public.pipelines (workspace_id);

-- ── backfill: a personal workspace per data-owning user, then re-point records ─
insert into public.workspaces (owner_id, name, slug)
select distinct s.u, 'Personal', 'ws-' || substr(s.u::text, 1, 8)
from (
  select user_id as u from public.pipelines where user_id is not null
  union select user_id from public.datasets where user_id is not null
  union select user_id from public.runs where user_id is not null
  union select user_id from public.takes where user_id is not null
) s
where s.u is not null and not exists (select 1 from public.workspaces w where w.owner_id = s.u);

insert into public.workspace_members (workspace_id, user_id, role, status)
select w.id, w.owner_id, 'owner', 'active' from public.workspaces w
where w.owner_id is not null
  and not exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = w.owner_id);

update public.pipelines p set workspace_id = (select w.id from public.workspaces w where w.owner_id = p.user_id order by w.created_at limit 1) where p.workspace_id is null and p.user_id is not null;
update public.datasets  d set workspace_id = (select w.id from public.workspaces w where w.owner_id = d.user_id order by w.created_at limit 1) where d.workspace_id is null and d.user_id is not null;
update public.runs      r set workspace_id = (select w.id from public.workspaces w where w.owner_id = r.user_id order by w.created_at limit 1) where r.workspace_id is null and r.user_id is not null;
update public.takes     t set workspace_id = (select w.id from public.workspaces w where w.owner_id = t.user_id order by w.created_at limit 1) where t.workspace_id is null and t.user_id is not null;

-- ── workspaces + members RLS: read by members, manage by admins ──────────────
drop policy if exists workspaces_owner on public.workspaces;
drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_member_read on public.workspaces for select to authenticated
  using (owner_id = auth.uid() or public.is_workspace_member(id));
drop policy if exists workspaces_admin_write on public.workspaces;
create policy workspaces_admin_write on public.workspaces for all to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(id))
  with check (owner_id = auth.uid() or public.is_workspace_admin(id));

drop policy if exists workspace_members_self on public.workspace_members;
drop policy if exists workspace_members_read on public.workspace_members;
create policy workspace_members_read on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
drop policy if exists workspace_members_admin_write on public.workspace_members;
create policy workspace_members_admin_write on public.workspace_members for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
-- a user may accept their own invitation (claim a membership row by email)
drop policy if exists workspace_members_accept_self on public.workspace_members;
create policy workspace_members_accept_self on public.workspace_members for update to authenticated
  using (invited_email is not null and lower(invited_email) = lower(auth.jwt() ->> 'email'))
  with check (user_id = auth.uid());

-- ── content RLS: read by member, write by editor (viewer = read-only) ────────
-- pipelines (templates stay public)
drop policy if exists pipelines_owned on public.pipelines;
drop policy if exists pipelines_ws_read on public.pipelines;
create policy pipelines_ws_read on public.pipelines for select to anon, authenticated
  using (workspace_id is null or is_template = true or public.is_workspace_member(workspace_id));
drop policy if exists pipelines_ws_write on public.pipelines;
create policy pipelines_ws_write on public.pipelines for all to anon, authenticated
  using (workspace_id is null or public.is_workspace_editor(workspace_id))
  with check (workspace_id is null or public.is_workspace_editor(workspace_id));

-- datasets
drop policy if exists datasets_owned on public.datasets;
drop policy if exists datasets_ws_read on public.datasets;
create policy datasets_ws_read on public.datasets for select to anon, authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));
drop policy if exists datasets_ws_write on public.datasets;
create policy datasets_ws_write on public.datasets for all to anon, authenticated
  using (workspace_id is null or public.is_workspace_editor(workspace_id))
  with check (workspace_id is null or public.is_workspace_editor(workspace_id));

-- takes
drop policy if exists takes_owned on public.takes;
drop policy if exists takes_ws_read on public.takes;
create policy takes_ws_read on public.takes for select to anon, authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));
drop policy if exists takes_ws_write on public.takes;
create policy takes_ws_write on public.takes for all to anon, authenticated
  using (workspace_id is null or public.is_workspace_editor(workspace_id))
  with check (workspace_id is null or public.is_workspace_editor(workspace_id));

-- runs (read by member; written by editors + the headless worker via null-workspace/service role)
do $$ begin
  if to_regclass('public.runs') is not null then
    execute 'drop policy if exists runs_all on public.runs';
    execute 'drop policy if exists runs_ws on public.runs';
    execute 'create policy runs_ws on public.runs for all to anon, authenticated using (workspace_id is null or public.is_workspace_member(workspace_id)) with check (workspace_id is null or public.is_workspace_editor(workspace_id))';
  end if;
end $$;

-- shares / library / triggers (created in 0011–0013; guard for presence)
do $$ begin
  if to_regclass('public.library_assets') is not null then
    execute 'drop policy if exists library_assets_owned on public.library_assets';
    execute 'create policy library_assets_ws on public.library_assets for all to anon, authenticated using (workspace_id is null or public.is_workspace_member(workspace_id)) with check (workspace_id is null or public.is_workspace_editor(workspace_id))';
  end if;
  if to_regclass('public.triggers') is not null then
    execute 'drop policy if exists triggers_owner on public.triggers';
    execute 'create policy triggers_ws on public.triggers for all to anon, authenticated using (workspace_id is null or public.is_workspace_member(workspace_id)) with check (workspace_id is null or public.is_workspace_editor(workspace_id))';
  end if;
  if to_regclass('public.pipeline_shares') is not null then
    execute 'drop policy if exists pipeline_shares_owner on public.pipeline_shares';
    execute 'create policy pipeline_shares_ws on public.pipeline_shares for all to anon, authenticated using (workspace_id is null or public.is_workspace_member(workspace_id)) with check (workspace_id is null or public.is_workspace_editor(workspace_id))';
  end if;
end $$;
