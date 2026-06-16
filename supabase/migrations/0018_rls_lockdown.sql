-- Flowmind Prompt 11 — RLS lockdown (REVIEW BEFORE APPLYING).
--
-- Replaces the transitional, permissive policies (anonymous access + `using (true)` +
-- `workspace_id is null` write escapes) with production-correct, owner/workspace-scoped policies.
-- After this migration:
--   • No `anon` role can read or write any private table.
--   • Authenticated users reach a row only through workspace membership (or direct ownership).
--   • Public templates stay readable (read-only) so the Templates gallery still works.
--   • Service-role writes (the headless worker, Stripe webhook, run-app share reads) still bypass
--     RLS as before — confirm SUPABASE_SERVICE_ROLE_KEY is configured in production.
--
-- DEPENDENCIES (apply AFTER both are true):
--   1. Auth is enabled (NEXT_PUBLIC_AUTH_ENABLED=true) and every writer is signed in.
--   2. The public demo is the static /try canvas (Prompts 12–13) — it no longer writes to the DB.
--
-- Idempotent: every policy is dropped-if-exists before create. Reversible: re-run
-- 0015_workspaces.sql (and 0001/0002/0003/0005/0006 for the legacy tables) to restore the prior
-- permissive shape. NOTE: existing null-workspace / null-owner rows become inaccessible to clients
-- after this — back-fill their workspace_id/user_id first (see docs/RLS_LOCKDOWN.md).

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Helper: membership/editor functions already exist from 0015 (is_workspace_member /
-- is_workspace_editor, SECURITY DEFINER). This migration reuses them — it does not redefine them.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── pipelines: templates public-read; otherwise workspace-scoped, authenticated only ──────────
alter table public.pipelines enable row level security;
drop policy if exists pipelines_all on public.pipelines;
drop policy if exists pipelines_owned on public.pipelines;
drop policy if exists pipelines_ws_read on public.pipelines;
drop policy if exists pipelines_ws_write on public.pipelines;
-- Public, read-only access to seeded templates only (no private rows leak).
drop policy if exists pipelines_templates_read on public.pipelines;
create policy pipelines_templates_read on public.pipelines for select to anon, authenticated
  using (is_template = true);
drop policy if exists pipelines_member_read on public.pipelines;
create policy pipelines_member_read on public.pipelines for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists pipelines_editor_write on public.pipelines;
create policy pipelines_editor_write on public.pipelines for insert to authenticated
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists pipelines_editor_update on public.pipelines;
create policy pipelines_editor_update on public.pipelines for update to authenticated
  using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists pipelines_editor_delete on public.pipelines;
create policy pipelines_editor_delete on public.pipelines for delete to authenticated
  using (public.is_workspace_editor(workspace_id));

-- ── datasets: workspace-scoped, authenticated only ────────────────────────────────────────────
alter table public.datasets enable row level security;
drop policy if exists datasets_all on public.datasets;
drop policy if exists datasets_owned on public.datasets;
drop policy if exists datasets_ws_read on public.datasets;
drop policy if exists datasets_ws_write on public.datasets;
drop policy if exists datasets_member_read on public.datasets;
create policy datasets_member_read on public.datasets for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists datasets_editor_write on public.datasets;
create policy datasets_editor_write on public.datasets for insert to authenticated
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists datasets_editor_update on public.datasets;
create policy datasets_editor_update on public.datasets for update to authenticated
  using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists datasets_editor_delete on public.datasets;
create policy datasets_editor_delete on public.datasets for delete to authenticated
  using (public.is_workspace_editor(workspace_id));

-- ── takes: workspace-scoped, authenticated only ───────────────────────────────────────────────
alter table public.takes enable row level security;
drop policy if exists takes_all on public.takes;
drop policy if exists takes_owned on public.takes;
drop policy if exists takes_ws_read on public.takes;
drop policy if exists takes_ws_write on public.takes;
drop policy if exists takes_member_read on public.takes;
create policy takes_member_read on public.takes for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists takes_editor_write on public.takes;
create policy takes_editor_write on public.takes for insert to authenticated
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists takes_editor_update on public.takes;
create policy takes_editor_update on public.takes for update to authenticated
  using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));
drop policy if exists takes_editor_delete on public.takes;
create policy takes_editor_delete on public.takes for delete to authenticated
  using (public.is_workspace_editor(workspace_id));

-- ── runs: member-read, editor-write; headless worker writes via service role (bypasses RLS) ───
do $$ begin
  if to_regclass('public.runs') is not null then
    execute 'alter table public.runs enable row level security';
    execute 'drop policy if exists runs_all on public.runs';
    execute 'drop policy if exists runs_ws on public.runs';
    execute 'drop policy if exists runs_member_read on public.runs';
    execute 'create policy runs_member_read on public.runs for select to authenticated using (public.is_workspace_member(workspace_id))';
    execute 'drop policy if exists runs_editor_write on public.runs';
    execute 'create policy runs_editor_write on public.runs for insert to authenticated with check (public.is_workspace_editor(workspace_id))';
    execute 'drop policy if exists runs_editor_update on public.runs';
    execute 'create policy runs_editor_update on public.runs for update to authenticated using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))';
    execute 'drop policy if exists runs_editor_delete on public.runs';
    execute 'create policy runs_editor_delete on public.runs for delete to authenticated using (public.is_workspace_editor(workspace_id))';
  end if;
end $$;

-- ── library_assets / triggers / pipeline_shares: member-read, editor-write (guard for presence) ─
do $$ begin
  if to_regclass('public.library_assets') is not null then
    execute 'alter table public.library_assets enable row level security';
    execute 'drop policy if exists library_assets_owned on public.library_assets';
    execute 'drop policy if exists library_assets_ws on public.library_assets';
    execute 'drop policy if exists library_assets_member_read on public.library_assets';
    execute 'create policy library_assets_member_read on public.library_assets for select to authenticated using (public.is_workspace_member(workspace_id))';
    execute 'drop policy if exists library_assets_editor_write on public.library_assets';
    execute 'create policy library_assets_editor_write on public.library_assets for all to authenticated using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))';
  end if;
  if to_regclass('public.triggers') is not null then
    execute 'alter table public.triggers enable row level security';
    execute 'drop policy if exists triggers_owner on public.triggers';
    execute 'drop policy if exists triggers_ws on public.triggers';
    execute 'drop policy if exists triggers_member_read on public.triggers';
    execute 'create policy triggers_member_read on public.triggers for select to authenticated using (public.is_workspace_member(workspace_id))';
    execute 'drop policy if exists triggers_editor_write on public.triggers';
    execute 'create policy triggers_editor_write on public.triggers for all to authenticated using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))';
  end if;
  if to_regclass('public.pipeline_shares') is not null then
    -- Public link reads happen server-side via the service role (lib/sharing/server.ts), NOT anon RLS.
    execute 'alter table public.pipeline_shares enable row level security';
    execute 'drop policy if exists pipeline_shares_owner on public.pipeline_shares';
    execute 'drop policy if exists pipeline_shares_ws on public.pipeline_shares';
    execute 'drop policy if exists pipeline_shares_member_read on public.pipeline_shares';
    execute 'create policy pipeline_shares_member_read on public.pipeline_shares for select to authenticated using (public.is_workspace_member(workspace_id))';
    execute 'drop policy if exists pipeline_shares_editor_write on public.pipeline_shares';
    execute 'create policy pipeline_shares_editor_write on public.pipeline_shares for all to authenticated using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id))';
  end if;
end $$;

-- ── exports: user_id present (0007) + workspace_id (0015). Owner/member scoped, authed only. ──
do $$ begin
  if to_regclass('public.exports') is not null then
    execute 'alter table public.exports enable row level security';
    execute 'drop policy if exists exports_all on public.exports';
    execute 'drop policy if exists exports_owner on public.exports';
    execute 'create policy exports_owner on public.exports for all to authenticated using (user_id = auth.uid() or public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() or public.is_workspace_editor(workspace_id))';
  end if;
end $$;

-- ── child tables with no own owner column → scope through the parent's ownership ──────────────
-- pipeline_versions → pipelines
do $$ begin
  if to_regclass('public.pipeline_versions') is not null then
    execute 'alter table public.pipeline_versions enable row level security';
    execute 'drop policy if exists pipeline_versions_all on public.pipeline_versions';
    execute 'create policy pipeline_versions_via_pipeline on public.pipeline_versions for all to authenticated '
         || 'using (exists (select 1 from public.pipelines p where p.id = pipeline_versions.pipeline_id and public.is_workspace_member(p.workspace_id))) '
         || 'with check (exists (select 1 from public.pipelines p where p.id = pipeline_versions.pipeline_id and public.is_workspace_editor(p.workspace_id)))';
  end if;
end $$;

-- dataset_versions → datasets
do $$ begin
  if to_regclass('public.dataset_versions') is not null then
    execute 'alter table public.dataset_versions enable row level security';
    execute 'drop policy if exists dataset_versions_all on public.dataset_versions';
    execute 'create policy dataset_versions_via_dataset on public.dataset_versions for all to authenticated '
         || 'using (exists (select 1 from public.datasets d where d.id = dataset_versions.dataset_id and public.is_workspace_member(d.workspace_id))) '
         || 'with check (exists (select 1 from public.datasets d where d.id = dataset_versions.dataset_id and public.is_workspace_editor(d.workspace_id)))';
  end if;
end $$;

-- eval_scores → takes (preferred) else pipelines
do $$ begin
  if to_regclass('public.eval_scores') is not null then
    execute 'alter table public.eval_scores enable row level security';
    execute 'drop policy if exists eval_scores_all on public.eval_scores';
    execute 'create policy eval_scores_via_parent on public.eval_scores for all to authenticated '
         || 'using (exists (select 1 from public.takes t where t.id = eval_scores.take_id and public.is_workspace_member(t.workspace_id))) '
         || 'with check (exists (select 1 from public.takes t where t.id = eval_scores.take_id and public.is_workspace_editor(t.workspace_id)))';
  end if;
end $$;

-- ── legacy registry tables (tools / model_configs): no owner column and unused by the app
--    (the live tool/model registries live in code under lib/tools + lib/models). Lock to
--    service-role only by dropping the permissive policy and adding NO client policy → RLS
--    denies all anon + authenticated access. Add ownership columns before re-opening them. ─────
do $$ begin
  if to_regclass('public.tools') is not null then
    execute 'alter table public.tools enable row level security';
    execute 'drop policy if exists tools_all on public.tools';
  end if;
  if to_regclass('public.model_configs') is not null then
    execute 'alter table public.model_configs enable row level security';
    execute 'drop policy if exists model_configs_all on public.model_configs';
  end if;
end $$;
