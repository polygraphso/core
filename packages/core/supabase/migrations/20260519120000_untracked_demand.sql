-- untracked_demand: anonymous aggregate counter for CLI lookups against
-- server_refs that aren't in our tracked set. Bumped by POST /api/cli/check
-- on a miss. Read periodically by scoring to surface seed-expansion
-- candidates (highest-demand untracked refs become next-round curation
-- targets — see scoring-brief.md "Notify-funnel fulfillment").
--
-- No PII: the only key is the raw server_ref string the CLI saw.

create table if not exists untracked_demand (
  server_ref      text primary key,
  request_count   integer not null default 0,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

create index if not exists untracked_demand_request_count_idx
  on untracked_demand (request_count desc);

create index if not exists untracked_demand_last_seen_at_idx
  on untracked_demand (last_seen_at desc);

-- Default-privileges grant from 20260518160000_grant_service_role.sql
-- already covers this table, but be explicit for clarity. RLS stays enabled
-- (no anon policy — the bump runs through the Next.js API route with the
-- service-role key, matching the project_supabase_access pattern).

alter table untracked_demand enable row level security;

grant all on table public.untracked_demand to service_role, postgres;

-- Atomic bump helper. The API route calls this via supabase.rpc() so the
-- counter increment + last_seen_at update happen in a single round-trip,
-- and we don't need to read-then-write (which would race under concurrent
-- CLI misses for the same ref).

create or replace function bump_untracked_demand(p_server_ref text)
returns void
language sql
security definer
as $$
  insert into untracked_demand (server_ref, request_count, first_seen_at, last_seen_at)
  values (p_server_ref, 1, now(), now())
  on conflict (server_ref) do update
  set request_count = untracked_demand.request_count + 1,
      last_seen_at  = now();
$$;

revoke all on function bump_untracked_demand(text) from public;
grant execute on function bump_untracked_demand(text) to service_role, postgres;
