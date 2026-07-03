-- agents + agent_activity: who is calling the public /api/cli endpoints.
--
-- grade_requests.agent_id attributes only the rare request_grade write; the
-- common path (check) records nothing about the caller, and raw callers
-- (curl, scripts, integrations) are invisible. These tables make the callers
-- observable:
--
--   * agents          — the registry: one row per distinct agent build
--                       ("claude-code/2.1.199", or "ua:curl/8.6" for raw
--                       callers), with the metadata the MCP handshake declares
--                       (title, websiteUrl, description, capabilities).
--   * agent_activity  — day-bucketed counters per (day, agent_name, endpoint),
--                       keyed by the versionless name to bound cardinality;
--                       version detail lives in agents.
--
-- Privacy: SOFTWARE metadata + aggregate counters only (the untracked_demand
-- posture). No IPs, no geo, no install IDs, no per-request event log. All
-- inputs are length-capped by the API layer (web/lib/agentIdentity.ts); the
-- checks here are the backstop.
--
-- Service-role only: bumped by the Next.js API routes, RLS on with no anon
-- policy.

create table if not exists agents (
  agent_id       text primary key check (char_length(agent_id) between 1 and 200),
  name           text not null check (char_length(name) between 1 and 120),
  version        text check (version is null or char_length(version) <= 40),
  source         text not null check (source in ('mcp', 'cli', 'raw')),
  -- { title?, websiteUrl?, description?, capabilities?: string[] } — as declared
  -- by the client in the MCP initialize handshake. Refreshed on every call.
  meta           jsonb,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  call_count     bigint not null default 0
);

create index if not exists agents_name_idx on agents (name);
create index if not exists agents_last_seen_idx on agents (last_seen_at desc);

create table if not exists agent_activity (
  day         date not null,
  agent_name  text not null check (char_length(agent_name) between 1 and 120),
  endpoint    text not null check (endpoint in ('check', 'list', 'grade_request')),
  hit_count   bigint not null default 0,
  miss_count  bigint not null default 0,
  call_count  bigint not null default 0,
  primary key (day, agent_name, endpoint)
);

create index if not exists agent_activity_day_idx on agent_activity (day desc);

alter table agents enable row level security;
alter table agent_activity enable row level security;

grant all on table public.agents to service_role, postgres;
grant all on table public.agent_activity to service_role, postgres;

-- One round trip per API call: upsert the registry row (refresh last_seen,
-- meta, count) and bump today's activity counters. p_hit: true/false for
-- check (hit = a published grade was returned), null for list/grade_request.
create or replace function record_agent_call(
  p_agent_id text,
  p_name     text,
  p_version  text,
  p_meta     jsonb,
  p_source   text,
  p_endpoint text,
  p_hit      boolean default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into agents (agent_id, name, version, source, meta, call_count)
  values (p_agent_id, p_name, p_version, p_source, p_meta, 1)
  on conflict (agent_id) do update
    set last_seen_at = now(),
        call_count   = agents.call_count + 1,
        meta         = coalesce(excluded.meta, agents.meta),
        source       = excluded.source;

  insert into agent_activity (day, agent_name, endpoint, hit_count, miss_count, call_count)
  values (
    (now() at time zone 'utc')::date,
    p_name,
    p_endpoint,
    case when p_hit is true then 1 else 0 end,
    case when p_hit is false then 1 else 0 end,
    1
  )
  on conflict (day, agent_name, endpoint) do update
    set hit_count  = agent_activity.hit_count  + (case when p_hit is true then 1 else 0 end),
        miss_count = agent_activity.miss_count + (case when p_hit is false then 1 else 0 end),
        call_count = agent_activity.call_count + 1;
$$;

revoke all on function record_agent_call(text, text, text, jsonb, text, text, boolean) from public;
grant execute on function record_agent_call(text, text, text, jsonb, text, text, boolean)
  to service_role, postgres;
