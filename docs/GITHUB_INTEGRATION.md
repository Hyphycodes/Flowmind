# GitHub Integration

Flowmind can take a finished AI-system blueprint and push it into a real GitHub repo as a
branch or a pull request — _"I put the AI system into your repo and opened a PR."_ This
complements the ZIP export; it never replaces it.

## Three separate concepts (do not blur them)

1. **Sign in with GitHub** — authentication/login only. Creating a Flowmind account with
   GitHub does **not** grant repo access.
2. **Connect GitHub Repository** — a GitHub **App** installation that authorizes Flowmind to
   read/write _selected_ repositories.
3. **GitHub PR export** — using that connection to create a branch, commit the export bundle,
   and open a PR.

## Why a GitHub App (not a personal access token)

- Repo-scoped permissions, installed on selected repos.
- Proper contents/PR/issues permissions; safer than broad personal tokens.
- Better path for organizations and enterprise.
- Tokens are short-lived installation tokens minted **server-side** on demand.

Personal access tokens are intentionally **not** the design. An OAuth-app fallback
(`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`) exists in env only as a last resort.

## Requested permissions (minimal)

| Permission         | Level        | Why                                  |
| ------------------ | ------------ | ------------------------------------ |
| Repository contents| read / write | Commit export files to a branch      |
| Pull requests      | read / write | Open the PR                          |
| Issues             | read / write | Create implementation issues (opt-in)|
| Metadata           | read         | Required baseline                    |

Avoid Administration. Actions only later, if generating workflow files.

## Setup

1. Create a GitHub App (Settings → Developer settings → GitHub Apps). Set the callback URL to
   `${NEXT_PUBLIC_APP_URL}/api/github/callback` and request the permissions above.
2. Generate a private key (PEM) and copy the App ID + slug.
3. Set env vars (see `.env.example`):
   ```
   GITHUB_APP_ID=
   GITHUB_APP_PRIVATE_KEY=        # PEM; \n-escaped single line is supported
   NEXT_PUBLIC_GITHUB_APP_SLUG=
   GITHUB_APP_CLIENT_ID=          # optional (user OAuth)
   GITHUB_APP_CLIENT_SECRET=      # optional
   GITHUB_WEBHOOK_SECRET=         # optional
   ```
   GitHub export also requires auth (`NEXT_PUBLIC_AUTH_ENABLED=true`) and
   `FLOWMIND_TOKEN_ENCRYPTION_SECRET` (shared with the Google connector).
4. Apply migration `supabase/migrations/0008_github_integration.sql` (after `0007`).

`githubConfigured()` (in `lib/auth/config.ts`) gates the whole feature; when off, the UI shows
a clear "not configured" state and the ZIP export is unaffected.

## Connect flow

1. Settings → Connected Accounts → **GitHub Repositories → Connect**, or the Export dialog's
   GitHub tab.
2. `GET /api/github/connect` redirects to the App install page
   (`github.com/apps/<slug>/installations/new`).
3. The user installs the App on selected repos.
4. GitHub redirects to `GET /api/github/callback?installation_id=…`. We fetch the installation
   (account, permissions, repos) via the App JWT and persist **metadata only** in
   `github_connections` — **no tokens**.
5. `GET /api/github/status` returns a sanitized status (never tokens).

## Security model

- The App private key and installation tokens are **server-only**. They are never sent to the
  browser, stored in pipeline JSON, or included in any export.
- Installation access tokens are minted on demand (`lib/github/app.ts`) and discarded.
- Every write route validates the session, the connection, and that the target repo belongs to
  the installation (`lib/github/server.ts`).
- Export safety scan (`lib/github/secretScan.ts`) blocks pushes when file content matches
  secret patterns, and refuses `.env*` files outright.

## API routes

```
/api/github/connect              start App install
/api/github/callback             persist installation metadata
/api/github/status               sanitized status (no tokens)
/api/github/disconnect           remove connection
/api/github/repositories         list installation repos
/api/github/repositories/[owner]/[repo]/tree   repo structure + placement hint
/api/github/repositories/[owner]/[repo]/files  read a file
/api/github/export               branch + commit (+ optional PR)
/api/github/create-issues        draft/create implementation issues
/api/github/tools/list-issues    GitHub Issues source
/api/github/tools/list-pull-requests  GitHub PRs source
```

## Library

`lib/github/` — `app.ts` (App JWT + installation token), `client.ts` (REST client),
`connection.ts` (persistence), `server.ts` (route guard), `exportToRepo.ts` (commit + PR),
`pullRequests.ts` (PR body), `issues.ts` (issue drafts), `fileTree.ts` (placement), `secretScan.ts`,
`types.ts`.

## Limitations

- `github_search_code` and `github_read_pr_diff` tools are registered but marked disabled
  (no live handler yet).
- Commits go one file at a time via the contents API (fine for export bundles); very large
  bundles could hit rate limits.
- Org installs may require admin approval (`setup_action=request`) — the callback records a
  pending state.

See also: [GITHUB_EXPORT.md](GITHUB_EXPORT.md), [REPO_SOURCE_NODES.md](REPO_SOURCE_NODES.md).
