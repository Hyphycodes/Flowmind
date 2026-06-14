# GitHub Source & Tool Nodes

GitHub isn't only an export target — a connected repo can be a **data/tool source** inside a
pipeline, enabling systems like issue triage, PR reviewer, codebase Q&A, release-notes generator,
and changelog/doc builders.

## Source modes

`lib/pipeline/schema.ts` adds four additive Source Modes (the binding holds **references only**,
never tokens — see `githubSourceConfigSchema`):

| Mode                   | Binding fields                         |
| ---------------------- | -------------------------------------- |
| `github_repo`          | `repositoryFullName`, `ref`            |
| `github_file`          | `repositoryFullName`, `ref`, `path`    |
| `github_issues`        | `repositoryFullName`, `issueState`     |
| `github_pull_requests` | `repositoryFullName`, `issueState`     |

They appear in the Source Mode picker (`lib/datasets/sourceModes.ts`).

## Tool registry

`lib/tools/registry.ts` adds GitHub tool definitions (categories `code` / `source` / `developer`):

| Tool                          | Status     | Live route                                         |
| ----------------------------- | ---------- | -------------------------------------------------- |
| GitHub Repo File Tree         | ready      | `/api/github/repositories/[owner]/[repo]/tree`     |
| GitHub Read File              | ready      | `/api/github/repositories/[owner]/[repo]/files`    |
| GitHub Search Code            | _disabled_ | —                                                  |
| GitHub List Issues            | ready      | `/api/github/tools/list-issues`                    |
| GitHub List Pull Requests     | ready      | `/api/github/tools/list-pull-requests`             |
| GitHub Read PR Diff           | _disabled_ | —                                                  |
| GitHub Create Issue           | ready      | `/api/github/create-issues`                        |
| GitHub Commit Files           | ready      | `/api/github/export`                               |
| GitHub Create Pull Request    | ready      | `/api/github/export`                               |

Each tool declares required permissions, input/output schema, status, and risk level. Read/list
handlers are wired first; commit/PR/issue handlers run through the export + issues routes. Disabled
tools are clearly marked (`status: "disabled"`) so there are no fake buttons.

## Permissions & connection

All GitHub source/tool reads require a connected GitHub App installation and run server-side
through the same guard (`lib/github/server.ts`) that validates the session, the connection, and that
the requested repo belongs to the installation. Tokens never reach the browser.

## Example pipelines

- **Issue triage** — `github_issues` source → classifier crew → labeled-issues table.
- **PR reviewer** — `github_pull_requests` + (future) PR diff → reviewer crew → review-comments table.
- **Codebase Q&A** — `github_repo` tree + `github_file` reads → retrieval crew → answer surface.
- **Release notes** — `github_pull_requests` (merged) → summarizer → release-notes doc.
