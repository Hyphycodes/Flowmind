# Automation — Triggers (Prompt 06)

Pipelines that run themselves: on a schedule, from a webhook, or after another pipeline
finishes. This is real background execution, not frontend polling.

## Infra choice — (B) Vercel Cron + a durable run endpoint

Flowmind runs on Vercel + Supabase. We use **Vercel Cron** as the scheduler and a **durable
worker route** as the executor, with Supabase as the trigger store. (Option A — Supabase
pg_cron / Edge Functions + a queue table — would also work; if you self-host, point a
pg_cron job or any external scheduler at `POST /api/automation/tick` instead of Vercel Cron.)

- `vercel.json` declares a cron that hits **`/api/automation/tick`** every minute.
- The tick (`lib/automation/worker.ts → processDueTriggers`) loads enabled `schedule` triggers
  and fires the ones whose cron matches the current minute in their timezone
  (`lib/automation/cron.ts`). `triggers.last_fired_at` prevents double-firing within a minute.
- Webhooks (`POST /api/hooks/[token]`) and pipeline→pipeline chains fire on their own events —
  they don't wait for the tick.

Nothing is faked inside a normal request: the tick and webhook routes invoke the **headless
run core** (`lib/run/runPipelineHeadless`), which runs the pipeline to completion and persists a
`RunTrace` — no browser tab required.

## One run engine

`lib/run/core.ts → runPipelineCore` is the single execution engine. It powers:

- the interactive streaming route `POST /api/run` (passes an `emit` callback to stream events),
- the hosted Run-App (`Task 05`),
- and the headless trigger worker (`lib/run/headless.ts → runPipelineHeadless`, no `emit`).

There is no second engine.

## Trigger types

`lib/automation/schema.ts → Trigger`:

- **schedule** — `{ cron, timezone }`. Fired by the tick when the cron matches. A human-readable
  preview + presets live in `lib/automation/cron.ts`.
- **webhook** — `{ token, inputMapping }`. `POST /api/hooks/<token>` maps the request body into the
  pipeline's input fields (`inputMapping`: `pipelineInputKey → bodyFieldName`; with no mapping,
  matching body keys are copied directly), runs headless, and returns the run id + final output.
  Rate-limited per token.
- **pipeline** — `{ upstreamPipelineId }`. After the upstream pipeline completes **successfully**,
  `fireDownstream` runs this one, passing the upstream's `finalOutput` highlights as inputs.
  **Cycle protection:** a direct self-loop is skipped and the chain depth is capped
  (`MAX_TRIGGER_CHAIN_DEPTH`), so A→B→A can never loop forever.

## Run attribution

Every run records how it started — `source` ∈ `manual | schedule | webhook | pipeline` — on the
`RunTrace` and the `runs.source` column (migration `0013`). Triggered runs are ordinary runs, so
they appear in `listRuns` and the Command Center activity feed, tagged by source.

## Setup

1. Apply migration `supabase/migrations/0013_triggers.sql` (triggers, trigger_runs, `runs.source`).
2. Deploy to Vercel — the cron in `vercel.json` registers automatically.
3. (Recommended) Set `CRON_SECRET` in the project env. Vercel Cron sends it as a Bearer token;
   `/api/automation/tick` rejects unauthenticated callers when it's set. With no secret (local/demo)
   the tick is open so you can invoke it manually: `curl -X POST http://localhost:3000/api/automation/tick`.
4. For real headless execution + persistence, `SUPABASE_SERVICE_ROLE_KEY` lets the worker read
   owner-scoped pipelines and write runs; without it, the worker uses the anon client (null-owned
   demo rows only).

## Security

- Webhook + schedule endpoints enforce auth/token server-side, never via the UI. RLS scopes
  trigger management to owners (transitional null-owned demo allowance, like the rest of 0007+).
- Webhooks are rate-limited per token; the tick is `CRON_SECRET`-gated in production.
- Triggered runs respect the same run engine (and, when billing is enabled, the same metering on
  the interactive path; headless metering attribution is a follow-up in the billing layer).

## Observability (Prompt 06b)

Unattended runs need to be trustworthy. `lib/automation/fire.ts → fireTrigger` wraps the headless
run with:

- **Per-firing history.** Each firing writes a `trigger_runs` row (status, duration, cost, attempt,
  error). The Triggers modal shows a health view per trigger (counts + recent firings), and the
  Command Center shows an automation-health tile + highlights failing triggers.
- **Auto-retry with backoff.** A failed run retries with bounded backoff (`RETRY_BACKOFF_MINUTES` =
  ~1m, 5m, 15m) up to `retry.maxAttempts` (default 3). Retries are driven by the same cron tick
  (`next_retry_at <= now`). Deterministic failures (invalid input/schema/not-found/etc.) are
  detected and **not** retried. A retry that succeeds resolves the alert; exhaustion escalates.
- **Alerts + dedupe.** On exhausted failure, an outbound webhook alert (Slack/Discord/Zapier
  incoming-webhook compatible) POSTs a compact JSON payload (pipeline, trigger, error, attempt,
  runId, deep link). The `alerted_failure` flag dedupes repeat failures; a **recovery** alert is
  sent when a previously-failing trigger succeeds again. Email is config-gated on a transactional
  provider — set `RESEND_API_KEY` (+ optional `ALERTS_EMAIL_FROM`) to enable it; otherwise email is
  a no-op (no new dependency, webhook is the baseline channel).
- **Manual controls.** `POST /api/automation/run-trigger` powers "run now" and "retry last failed"
  from the trigger health view; pause/resume is the enable toggle. All reuse the headless core.

Extra env: `RESEND_API_KEY`, `ALERTS_EMAIL_FROM` (email alerts), `NEXT_PUBLIC_APP_URL` (deep links
in alerts). Apply migration `0014_automation_observability.sql`.
