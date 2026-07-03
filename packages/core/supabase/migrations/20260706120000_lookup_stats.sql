-- lookup_stats: per-server hit/miss counter for POST /api/cli/check.
--
-- untracked_demand records only MISSES (lookups for ungraded servers), so it
-- can't tell us total lookup volume or the hit/miss ratio — i.e. how much the
-- free lookup is actually used, and how well our coverage matches demand. This
-- records EVERY lookup: a hit returned a published grade, a miss didn't.
--
-- No PII: the only key is the versionless server_ref the CLI/MCP saw. RLS on,
-- no anon policy — bumped by the /api/cli/check route with the service-role key
-- (same pattern as untracked_demand). This does not replace untracked_demand,
-- which the scoring pipeline still reads for seed-expansion.

create table if not exists lookup_stats (
  server_ref     text primary key,
  hit_count      bigint not null default 0,
  miss_count     bigint not null default 0,
  total_count    bigint generated always as (hit_count + miss_count) stored,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists lookup_stats_total_idx on lookup_stats (total_count desc);

alter table lookup_stats enable row level security;

grant all on table public.lookup_stats to service_role, postgres;

-- Atomic single-round-trip bump: p_hit true → hit_count++, else miss_count++.
create or replace function bump_lookup(p_server_ref text, p_hit boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into lookup_stats (server_ref, hit_count, miss_count)
  values (
    p_server_ref,
    case when p_hit then 1 else 0 end,
    case when p_hit then 0 else 1 end
  )
  on conflict (server_ref) do update
    set hit_count    = lookup_stats.hit_count + (case when p_hit then 1 else 0 end),
        miss_count   = lookup_stats.miss_count + (case when p_hit then 0 else 1 end),
        last_seen_at = now();
$$;

revoke all on function bump_lookup(text, boolean) from public;
grant execute on function bump_lookup(text, boolean) to service_role, postgres;
