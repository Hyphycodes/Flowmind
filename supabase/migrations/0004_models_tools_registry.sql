-- Multi-model provider and tool registry foundations.
-- This is additive and does not change existing pipeline/run tables.

create table if not exists model_configs (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  model_id text not null,
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tool_definitions (
  id text primary key,
  name text not null,
  description text,
  category text,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tool_traces (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid,
  run_id uuid,
  node_id text,
  agent_id text,
  tool_id text,
  trace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tool_traces_pipeline_id_idx on tool_traces (pipeline_id);
create index if not exists tool_traces_run_id_idx on tool_traces (run_id);
