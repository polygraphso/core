-- Harden the two early SECURITY DEFINER functions that predate the
-- explicit-search_path convention (later RPCs — record_grade_request,
-- record_notify_request, record_waitlist_signup — already pin it).
--
-- A SECURITY DEFINER function runs with the owner's privileges; without a
-- pinned search_path, a caller who can influence the session search_path could
-- resolve an unqualified name (e.g. now(), pg_notify, or the target table) to an
-- object in a schema they control. Pinning `search_path = public` closes that
-- privilege-boundary gap. Append-only: we CREATE OR REPLACE with identical
-- bodies, adding only `set search_path = public`. Grants are unchanged by
-- REPLACE but re-stated for a self-consistent fresh-DB replay.

create or replace function bump_untracked_demand(p_server_ref text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into untracked_demand (server_ref, request_count, first_seen_at, last_seen_at)
  values (p_server_ref, 1, now(), now())
  on conflict (server_ref) do update
  set request_count = untracked_demand.request_count + 1,
      last_seen_at  = now();
$$;

revoke all on function bump_untracked_demand(text) from public;
grant execute on function bump_untracked_demand(text) to service_role, postgres;

create or replace function polygraph_notify(
  channel text,
  payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if channel not in ('version_detected', 'grade_computed', 'alert_fired') then
    raise exception 'polygraph_notify: unknown channel %', channel;
  end if;
  perform pg_notify(channel, payload::text);
end;
$$;

revoke all on function polygraph_notify(text, jsonb) from public;
grant execute on function polygraph_notify(text, jsonb) to service_role, postgres;
