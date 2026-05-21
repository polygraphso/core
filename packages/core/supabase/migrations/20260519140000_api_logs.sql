-- api_logs: one row per inbound API request, written fire-and-forget from
-- the per-route withApiLogging() wrapper in web/lib/api-logging.ts. Feeds
-- the /admin dashboard's "API calls" and "per route" panels.
--
-- No request bodies, no full user agents (truncated to 256 chars), no PII.
-- Sampling rate is 100% in v0 — low traffic; tighten later if volume grows.

create table if not exists api_logs (
  id            uuid primary key default gen_random_uuid(),
  route         text not null,
  method        text not null,
  status        integer not null,
  latency_ms    integer not null,
  requested_at  timestamptz not null default now(),
  user_agent    text,
  constraint api_logs_user_agent_len check (
    user_agent is null or char_length(user_agent) <= 256
  )
);

create index if not exists api_logs_requested_at_idx
  on api_logs (requested_at desc);

create index if not exists api_logs_route_requested_at_idx
  on api_logs (route, requested_at desc);

-- Default-privileges grant from 20260518160000_grant_service_role.sql covers
-- this table, but be explicit. RLS on, no anon policy — the writes run
-- through the Next.js routes with the service-role key.

alter table api_logs enable row level security;

grant all on table public.api_logs to service_role, postgres;
