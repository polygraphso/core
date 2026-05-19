-- Helper for application-side LISTEN/NOTIFY emission.
--
-- Called via supabase.rpc('polygraph_notify', { channel, payload }). The
-- channel name is allowlisted so this RPC can't be used to emit on
-- arbitrary channels. Payload is jsonb on the wire; pg_notify accepts only
-- text, so we serialize at the boundary.
--
-- See packages/core/src/types.ts for the canonical payload shapes
-- (VersionDetectedPayload, GradeComputedPayload, AlertFiredPayload).
--
-- Consumers should use pg-listen (or direct LISTEN sql) on a long-lived
-- postgres connection. Supabase Realtime is not used here — the contracts
-- doc specifies direct LISTEN/NOTIFY.

create or replace function polygraph_notify(
  channel text,
  payload jsonb
) returns void
language plpgsql
security definer
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
