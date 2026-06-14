# Export Security

Exports are a core Flowmind feature — and the highest-risk surface for accidental leakage. A single
shared scanner guards every export path.

## One scanner, both paths

`lib/security/secrets.ts` is canonical (`lib/github/secretScan.ts` re-exports it for back-compat):

- `scanExportFilesForSecrets(files)` → findings
- `checkExportSafety(files)` → `{ ok, findings }`
- `assertNoSecretsInExport(files)` → throws a clean error if anything looks like a secret

It runs before:

- **ZIP download** — `createExportBundle` (`lib/export/bundle.ts`) calls `assertNoSecretsInExport`
  before zipping. A blocked export surfaces a clean notice in the UI; nothing downloads.
- **GitHub PR export** — `app/api/github/export` calls `scanExportFilesForSecrets` before any branch
  is created or file committed (422 with findings on a hit).

## What it blocks

- Private key blocks (`-----BEGIN … PRIVATE KEY-----`)
- Provider keys: Anthropic (`sk-ant-…`), OpenAI (`sk-…`), Google (`AIza…`), AWS (`AKIA…`)
- Stripe secret keys (`sk_live_…` / `sk_test_…`), GitHub tokens (`ghp_…`, `github_pat_…`)
- Supabase service-role JWTs (`eyJ….….…`), Slack tokens, `Bearer …` tokens
- `KEY=value` lines assigning a secret-looking value to a `*SECRET*/*TOKEN*/*API_KEY*` name
- `.env.local` / `.env.production` / `.env.development` filenames (blocked outright)

## What it allows

- `.env.example` with **empty** placeholders (`ANTHROPIC_API_KEY=`)
- Required env var **names** in docs and PR descriptions (names, never values)
- Adapter stubs, source configs without secrets, public metadata

## By design

Flowmind exports are **deterministic and token-free** — OAuth tokens live encrypted in
`connected_accounts`, GitHub uses on-demand installation tokens, and pipeline JSON never holds
secrets. The scanner is therefore defense-in-depth: it should essentially never trigger, but it
guarantees a leak can't ship even if a future change introduces one.

## Verifying

```bash
npm run audit:secrets   # repo-level scan + .env ignore check
```

The readiness route also self-tests the scanner (feeds it a known-bad and a known-good sample).
