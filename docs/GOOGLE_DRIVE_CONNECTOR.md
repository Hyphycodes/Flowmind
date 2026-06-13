# Flowmind — Google Drive Connector

A connected account, **separate from Google sign-in**. The user explicitly authorizes Flowmind
to access **files they select** — not their whole Drive.

## Scopes (narrow by default)

`openid email https://www.googleapis.com/auth/drive.file`

`drive.file` = per-file access (files created or opened with this app via the Picker / by id).
No `drive` or `drive.readonly` (whole-Drive) scope. Broad scopes would require Google
verification and should be marked advanced.

## Token handling

- OAuth code is exchanged **server-side** (`lib/google/oauth.ts`).
- Access + refresh tokens are **AES-256-GCM encrypted** (`lib/auth/tokens.ts`,
  `FLOWMIND_TOKEN_ENCRYPTION_SECRET`) and stored in `connected_accounts`.
- Tokens are **never** sent to the browser, put in localStorage, stored in pipeline JSON, or
  exported. The client only ever sees status booleans + email + scope names.
- Tokens auto-refresh server-side when expired (`lib/google/account.ts`).

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/google/connect` | Start consent (sets a CSRF state cookie) |
| `GET /api/google/callback` | Exchange code → store encrypted tokens |
| `GET /api/google/status` | Sanitized connection status |
| `POST /api/google/disconnect` | Unlink (deletes tokens) |
| `GET /api/google-drive/files` | List accessible files |
| `GET /api/google-drive/file/[fileId]?mode=text` | File metadata / Doc text |
| `GET /api/google-drive/sheets/read?spreadsheetId&range` | Sheet rows → headers + rows |

## Tools

`google_drive_picker`, `google_drive_search`, `google_drive_file_meta`, `google_docs_fetch`,
`google_sheets_read` (`lib/tools/registry.ts`). Each declares scope + permission + IO schema.

## Source node usage

Set a Source node's mode to **Google Drive** in the inspector (`DriveSourceBlock`):
connection status → connect → enter a file/spreadsheet id → choose content mode
(metadata / text / **sheet rows → dataset** / link). "Use as source" reads the file and (for
sheets) imports rows into a Dataset bound to the node. File selection is stored in
`source.drive` (ids + metadata only).

## What's live vs. next

- **Live**: OAuth connect/callback/refresh/disconnect, status, and the Drive/Docs/Sheets read
  routes (work end-to-end once configured + a file is granted).
- **Next**: the Google **Picker** (currently manual file-id entry), folder/search pickers, and
  persisting selected-file rows into `google_drive_files`.

## Enable

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FLOWMIND_TOKEN_ENCRYPTION_SECRET`, and
`NEXT_PUBLIC_APP_URL`. Add `${NEXT_PUBLIC_APP_URL}/api/google/callback` as an authorized
redirect URI in the Google Cloud OAuth client. Enable the Drive + Sheets APIs in the project.
