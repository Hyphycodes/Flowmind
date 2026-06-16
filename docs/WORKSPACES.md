# Workspaces & Teams (Prompt 07)

A **workspace** is the unit of ownership and access. Every ownable record (pipelines, datasets,
runs, takes, shares, library assets, triggers) belongs to a workspace, and access is by
**membership at sufficient role** — enforced by RLS, never by the UI.

This is **config-gated like auth** (migration `0007`): the public demo runs with `auth` OFF and
all rows null-owned / **null-workspace**, so the demo is unaffected. The workspace layer activates
once you enable auth + apply `0015_workspaces.sql`.

## Model

- `lib/workspace/schema.ts` — `Workspace`, `Membership`, roles `owner | admin | member | viewer`.
- `workspaces` + `workspace_members` tables exist from `0007`; `0015` adds `status` + `invited_email`
  to memberships and `workspace_id` to every ownable table.
- Roles: **owner** (full control), **admin** (manage members + content), **member** (edit content),
  **viewer** (read-only — view and run, not edit).

## RLS (the boundary)

`0015` switches content RLS from `owner == auth.uid()` to membership-based, via SECURITY DEFINER
helpers `is_workspace_member(ws)` / `workspace_role(ws)` / `is_workspace_editor(ws)` /
`is_workspace_admin(ws)`:

- **Read** a row if `workspace_id is null` (demo) **or** you're a member of its workspace.
- **Write** a row only if you're an **editor** (owner/admin/member) — viewers are read-only at the
  RLS level, not just the UI.
- `workspaces` / `workspace_members`: members read; **admins** manage; a user can accept their own
  email invitation (`workspace_members_accept_self`).
- Templates stay public (`is_template = true`).

The transitional `workspace_id is null` allowance keeps the demo working. **Drop it** once all data
has a workspace for strict multi-tenancy.

### Verify tenant isolation

After enabling auth + applying `0015`, as a user who is a member of workspace **A** but not **B**:

```sql
-- should return ONLY workspace A's rows (and any null-workspace/template rows), never B's:
select id, workspace_id from pipelines;
select id, workspace_id from datasets;
-- attempt to read B directly — should return 0 rows:
select * from pipelines where workspace_id = '<workspace-B-id>';
-- attempt to write into B — should be rejected by RLS:
update pipelines set name = 'x' where workspace_id = '<workspace-B-id>';
```

## App wiring

- **Active workspace** is a client-side *filter* (`store/workspaceStore.ts`); access is always RLS.
  The sidebar `WorkspaceSwitcher` lists the workspaces you're a member of and lets you switch/create.
- **Membership management** (`lib/workspace/queries.ts`, `/workspace/settings`) uses the
  session-aware browser client so RLS sees your identity: invite by email, change role, remove,
  accept invites on login.
- **New pipelines** are stamped with the active `workspace_id` on create (`upsertPipeline`).
- **Presence** (`WorkspacePresence`) uses Supabase Realtime to show co-members.
- **Agency → client handoff**: invite a client as a `viewer` (run/read-only) from settings, or
  **move a pipeline** to another workspace from the Pipelines page (`transferPipeline` — requires
  editor in both, per RLS).

### Integration note

The membership RLS is the server-side access boundary and is in place. The existing **demo data
read path** still uses the legacy anon client (`lib/supabase/client.ts`), which — with no session —
reads only null-workspace rows (exactly the demo behavior). To fully activate workspace-scoped data
*reads/writes* for signed-in multi-workspace users, point those query functions at the session-aware
browser client (`lib/supabase/browser.ts`); RLS then scopes them to the caller's memberships. This
is intentionally the last switch to flip, so enabling auth never disturbs the public demo.

## Reversibility

`0015_workspaces_down.sql` restores the `0007` owner-scoped RLS and drops the helpers + `workspace_id`
columns. The backfilled workspaces/memberships are left in place (harmless). Tenant isolation must be
re-verified after any change here — a mistake is a cross-tenant data leak.
