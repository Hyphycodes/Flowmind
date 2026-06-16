-- Reverse of 0015_workspaces.sql. Restores the 0007 owner-scoped RLS, drops the membership-based
-- policies + helper functions + workspace_id columns. Run only to roll back Task 07. The backfilled
-- workspaces/memberships are left in place (harmless); delete them manually if a full revert is
-- desired. Idempotent.

-- restore content policies (owner-scoped, transitional null-owned demo) ─────────
drop policy if exists pipelines_ws_read on public.pipelines;
drop policy if exists pipelines_ws_write on public.pipelines;
create policy pipelines_owned on public.pipelines for all to anon, authenticated
  using (user_id is null or user_id = auth.uid() or is_template = true)
  with check (user_id is null or user_id = auth.uid());

drop policy if exists datasets_ws_read on public.datasets;
drop policy if exists datasets_ws_write on public.datasets;
create policy datasets_owned on public.datasets for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists takes_ws_read on public.takes;
drop policy if exists takes_ws_write on public.takes;
create policy takes_owned on public.takes for all to anon, authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

do $$ begin
  if to_regclass('public.runs') is not null then
    execute 'drop policy if exists runs_ws on public.runs';
    execute 'create policy runs_all on public.runs for all to anon, authenticated using (true) with check (true)';
  end if;
  if to_regclass('public.library_assets') is not null then
    execute 'drop policy if exists library_assets_ws on public.library_assets';
    execute 'create policy library_assets_owned on public.library_assets for all to anon, authenticated using (user_id is null or user_id = auth.uid()) with check (user_id is null or user_id = auth.uid())';
  end if;
  if to_regclass('public.triggers') is not null then
    execute 'drop policy if exists triggers_ws on public.triggers';
    execute 'create policy triggers_owner on public.triggers for all to anon, authenticated using (user_id is null or user_id = auth.uid()) with check (user_id is null or user_id = auth.uid())';
  end if;
  if to_regclass('public.pipeline_shares') is not null then
    execute 'drop policy if exists pipeline_shares_ws on public.pipeline_shares';
    execute 'create policy pipeline_shares_owner on public.pipeline_shares for all to anon, authenticated using (user_id is null or user_id = auth.uid()) with check (user_id is null or user_id = auth.uid())';
  end if;
end $$;

-- restore workspaces/members RLS to the 0007 shape ─────────────────────────────
drop policy if exists workspaces_member_read on public.workspaces;
drop policy if exists workspaces_admin_write on public.workspaces;
create policy workspaces_owner on public.workspaces for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists workspace_members_read on public.workspace_members;
drop policy if exists workspace_members_admin_write on public.workspace_members;
drop policy if exists workspace_members_accept_self on public.workspace_members;
create policy workspace_members_self on public.workspace_members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- drop helpers + columns ───────────────────────────────────────────────────────
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.workspace_role(uuid);
drop function if exists public.is_workspace_editor(uuid);
drop function if exists public.is_workspace_admin(uuid);

alter table public.pipelines drop column if exists workspace_id;
alter table public.datasets  drop column if exists workspace_id;
alter table public.runs      drop column if exists workspace_id;
alter table public.takes     drop column if exists workspace_id;
do $$ begin
  if to_regclass('public.pipeline_shares') is not null then execute 'alter table public.pipeline_shares drop column if exists workspace_id'; end if;
  if to_regclass('public.library_assets') is not null then execute 'alter table public.library_assets drop column if exists workspace_id'; end if;
  if to_regclass('public.triggers') is not null then execute 'alter table public.triggers drop column if exists workspace_id'; end if;
  if to_regclass('public.exports') is not null then execute 'alter table public.exports drop column if exists workspace_id'; end if;
end $$;
