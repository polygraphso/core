-- Abuse controls for the anonymous write/lookup APIs (cli/check, grade-requests,
-- notify, waitlist). These routes feed product-prioritization data (demand
-- counters, waitlists, notify funnels); without a limiter they are cheap to spam,
-- which both pollutes those signals and drives DB/operator load.
--
-- A fixed-window counter keyed on an opaque `bucket` (route + client IP). The web
-- layer is serverless, so an in-process limiter doesn't survive across instances;
-- this lives in the DB the routes already use. The increment is a single atomic
-- upsert (no read-then-write race), and the limiter rejects BEFORE the expensive
-- demand/notify RPC runs — so a flood is bounded growth of THIS small table
-- instead of unbounded growth of the demand tables.

create table if not exists rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_start_idx
  on rate_limits (window_start);

alter table rate_limits enable row level security;

grant all on table public.rate_limits to service_role, postgres;

-- Atomic "record one hit and tell me if we're still under the limit".
-- Returns true when the call is ALLOWED (count within p_max for the current
-- window), false when the limit is exceeded. Fixed window: the window start is
-- floored to a p_window_seconds boundary so all hits in the same window share one
-- row. Opportunistically (1% of calls) sweeps windows older than a day so the
-- table stays bounded without a separate cron.
create or replace function rate_limit_hit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  insert into rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update
    set count = rate_limits.count + 1
  returning count into v_count;

  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

revoke all on function rate_limit_hit(text, integer, integer) from public;
grant execute on function rate_limit_hit(text, integer, integer) to service_role, postgres;
