# OAuth & Connectors

Flowmind keeps **login** and **resource access** strictly separate, and every token is server-only.

## Login ≠ resource access

| Concept                | What it is                          | Grants repo/Drive access? |
| ---------------------- | ----------------------------------- | ------------------------- |
| Sign in with Google    | account auth (Supabase Auth)        | No                        |
| Connect Google Drive   | per-file `drive.file` OAuth         | Drive files you select    |
| Sign in with GitHub*   | account auth (if enabled)           | No                        |
| Connect GitHub repo    | GitHub **App** installation         | Selected repos only       |

\* GitHub sign-in is auth-only; repo access always goes through the GitHub App.

## Token safety (both connectors)

- Tokens are **server-only**: read inside Route Handlers, never sent to the browser, never in
  pipeline JSON, never exported, never logged (`redactSecrets` guards error paths).
- Google OAuth tokens are AES-256-GCM encrypted at rest (`connected_accounts.*_encrypted`,
  `FLOWMIND_TOKEN_ENCRYPTION_SECRET`). They are refreshed server-side; refresh failure falls back
  to the stored token and surfaces a reconnect state.
- GitHub stores **no token** — installation access tokens are minted on demand from the App
  private key + installation id (`lib/github/app.ts`) and discarded after use.
- Scopes are shown in the connected-account UI. Drive uses the narrow `drive.file` scope (only
  files the user picks), not full-Drive.

## Failure & disconnect states

- **Disconnected**: a Drive/GitHub source node degrades gracefully — sources fall back to their
  Input Studio dataset / deterministic output; the inspector shows the connection status.
- **Expired / revoked**: status flips to needs-reconnect; the UI offers Reconnect; nothing crashes.
- **Unlink**: removes the connection metadata (Google deletes the encrypted tokens; GitHub removes
  the installation metadata — the user should also uninstall the App to fully revoke).
- **Not configured**: the connect button shows a clear "not configured in this deployment" note;
  the ZIP export and the rest of the app keep working.

## Validation on every connector route

Connected-account routes validate the session (`getCurrentUser`) and that the requested resource
belongs to the user's connection/installation (`lib/github/server.ts` `clientForRepo`,
`repoBelongsToConnection`) before any read/write.

## Setup

- Google: `docs/GOOGLE_DRIVE_CONNECTOR.md`
- GitHub: `docs/GITHUB_INTEGRATION.md`
- Env: `docs/ENV_SETUP.md`
