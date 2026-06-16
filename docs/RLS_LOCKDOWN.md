# RLS Lockdown (Prompt 11) — review guide

`supabase/migrations/0018_rls_lockdown.sql` replaces the transitional permissive policies with
production-correct, owner/workspace-scoped policies. **Review and apply it by hand in the Supabase
dashboard — it is not applied automatically.** Apply it only after auth is enabled and the public
demo is the static `/try` canvas (Prompts 12–13).

## Inventory — the security gap being closed

| Table | Prior policy (the gap) | Ownership column |
| --- | --- | --- |
| `pipelines` | `anon` + `workspace_id is null` read/write escape (0015) | `workspace_id`, `user_id`, `is_template` |
| `datasets` | `anon` + null-workspace escape (0015) | `workspace_id`, `user_id` |
| `takes` | `anon` + null-workspace escape (0015) | `workspace_id`, `user_id` |
| `runs` | `anon` + null-workspace escape (0015) | `workspace_id`, `user_id` |
| `exports` | `using (true) to anon` (0006) | `user_id` (0007), `workspace_id` (0015) |
| `library_assets` | `anon` + null escape (0015) | `workspace_id`, `user_id` |
| `triggers` | `anon` + null escape (0015) | `workspace_id`, `user_id` |
| `pipeline_shares` | `anon` + null escape (0015) | `workspace_id`, `user_id` |
| `pipeline_versions` | `using (true) to anon` (0002) | **none** → scoped via parent `pipelines` |
| `dataset_versions` | `using (true) to anon` (0003) | **none** → scoped via parent `datasets` |
| `eval_scores` | `using (true) to anon` (0005) | **none** → scoped via parent `takes` |
| `tools` | `using (true) to anon` (0002) | **none** → locked to service-role |
| `model_configs` | `using (true) to anon` (0002) | **none** → locked to service-role |

Account/connector/billing tables (`0007`–`0009`, `0016`–`0017`) are already strictly owner/member
scoped and are **not** touched here.

## What each new policy allows / denies

- **`pipelines`** — Anyone (incl. logged-out) may **read templates** (`is_template = true`) so the
  gallery works. A signed-in user may **read** a pipeline only if they're a member of its
  workspace, and **insert/update/delete** only as a workspace *editor*. No anon writes.
- **`datasets` / `takes` / `runs` / `library_assets` / `triggers` / `pipeline_shares`** — Read by
  workspace **members**; write by workspace **editors**; authenticated only. No anon access.
  (The headless run worker and the public run-app share reader use the **service role**, which
  bypasses RLS — so they keep working. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in prod.)
- **`exports`** — Read/write by the **owner** (`user_id = auth.uid()`) or a workspace member/editor.
- **`pipeline_versions` / `dataset_versions` / `eval_scores`** — No own owner column, so each row is
  reachable only when the caller is a member/editor of the **parent** pipeline/dataset/take's
  workspace (via an `EXISTS` subquery).
- **`tools` / `model_configs`** — Legacy registry tables the app doesn't read at runtime (the live
  registries live in `lib/tools` + `lib/models`). The permissive policy is dropped and **no client
  policy replaces it**, so RLS denies all anon + authenticated access; only the service role can
  touch them. Add an ownership column before re-opening if you ever use them.

## App code paths that will break once tightened (and the fix)

1. **The anonymous demo builder writes null-owned pipelines/runs.** After lockdown, anon writes are
   denied. *Fix:* this is intended — the public demo becomes the static `/try` canvas (Prompts
   12–13), which makes **zero** DB writes. Do not apply `0018` until `/try` has shipped.
2. **`lib/supabase/client.ts` (anon) read paths for null-owned rows.** Any non-template read via the
   anon client returns empty after lockdown. *Fix:* route authenticated reads through
   `lib/supabase/browser.ts` / `serverClient.ts` (SSR auth); keep the anon client only for the
   public template read.
3. **Run-app share link reads** (`lib/sharing/server.ts`) — already use `getServerSupabase` (service
   role). *Fix:* ensure the **service role key is configured** in production; otherwise it falls back
   to the anon client, which can no longer read private shares.
4. **Headless trigger worker / Stripe webhook** — already service-role writes; unaffected.

## Existing data to handle before applying

- **Null-workspace / null-owner rows** created during the demo era become **inaccessible to
  clients** after lockdown (service role can still see them). Either back-fill
  `workspace_id` / `user_id` for rows you want to keep, or delete the throwaway demo rows. Suggested
  audit query (run as service role): `select count(*) from public.pipelines where workspace_id is
  null and is_template = false;` (repeat per table).

## Rollback

Re-running `0015_workspaces.sql` restores the workspace policies with the null-workspace escape; the
legacy `using (true)` tables (`pipeline_versions`, `dataset_versions`, `eval_scores`, `tools`,
`model_configs`) are restored by re-running their original migrations (`0002`/`0003`/`0005`). Nothing
in `0018` drops a column or deletes data, so rollback is policy-only.

## Future: collaborative/shared access (V2)

A "shared with" surface (per-user pipeline versions with merge/diff) would slot in as an additional
`select`/`insert` policy keyed off a `pipeline_collaborators` join table — alongside, not replacing,
the workspace-member policies above.
