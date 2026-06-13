# Flowmind — Export Format

Export is built by `lib/export/bundle.ts` (`createExportBundle(ctx, modes)`), opened via the
**Export dialog** (TopBar "Export" or the Output tab). Choose modes, see the readiness health
check, then download a ZIP. **No secret values are ever written.**

## Modes

| Mode | For | Adds |
| --- | --- | --- |
| `developer` | builders | machine-readable config, schemas, agents, crews, tools, models, datasets, contracts, packets, tables, ui, runs, takes, evals, product |
| `runtime` | integrators | `runtime/` — runnable example + portable runtime + adapter stubs + example I/O |
| `client_blueprint` | agencies / clients | `docs/client-blueprint.md` |
| `founder_brief` | founders | `docs/founder-brief.md` + `docs/implementation-plan.md` |
| `api` | integrators | `docs/api-docs.md` |

Always included: `README.md`, `SPEC.md`, `.env.example`, `package.json`, `tsconfig.json`,
`export-manifest.json` (every file + the health check).

## Health check

`lib/export/healthCheck.ts` runs ~14 deterministic checks (pipeline, schema, agents, crews,
tools, datasets, models, ui, runtime, docs, env). Status is `ready` / `warning` / `blocked`;
it **blocks only** when files would be broken (e.g. an empty pipeline). Warnings never block.

## Folder layout (developer + all modes)

```
README.md  SPEC.md  .env.example  package.json  tsconfig.json  export-manifest.json
pipeline/    pipeline.json, product-drop.json, reality-meter.json, source-brain-surface.json
schemas/     *.schema.json (field descriptors)
agents/      [node].json          crews/  [team].json
tools/       definitions + attachments + traces
models/      providers, definitions, selections, recommendations, router-notes.md
datasets/    datasets, dataset-schemas, source-configs, scenario-sets
contracts/   data-contracts, field-mappings, contract-warnings
packets/     handoff-packets, packet-timeline, field-drift-warnings
tables/      output-tables, latest-output-tables
ui/          ui-bindings, preview-config, preview-data
runs/        latest-run-trace, team-runs, agent-runs, tool-traces, cost-trace
takes/       takes, take-comparison      evals/  eval-scores, eval-summary
product/     product-variations, remix-proposals, product-brief.md
runtime/     flowmind-runtime.ts, run-pipeline.ts, types.ts, tool-adapters.ts,
             model-adapters.ts, example-input.json, example-output.json
docs/        client-blueprint.md, founder-brief.md, implementation-plan.md, api-docs.md
```

## Run the export

```bash
npm install
npm start            # runs runtime/run-pipeline.ts (simulate mode, no keys needed)
```

Live model/tool execution requires wiring `runtime/model-adapters.ts` + `runtime/tool-adapters.ts`.

## Hosted API

`POST /api/pipelines/{id}/run` with `{ input, mode, pipeline? }` returns final output, output
tables, handoff packets, and a trace summary. Ships without auth — add auth + rate limiting
before exposing publicly.
