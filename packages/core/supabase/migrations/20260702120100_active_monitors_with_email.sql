-- active_monitors_with_email(): security-definer view for the alert engine.
--
-- PostgREST can't join into the auth schema directly. This function does the
-- join so the GHA alert cron can resolve an email for user_id-based monitors
-- without exposing the auth.users table to the service role via raw SQL.
--
-- Returns one row per active (non-unsubscribed) monitor. Email is resolved as:
--   coalesce(monitors.email, auth.users.email)
-- The LEFT JOIN keeps grandfathered anonymous (email-only) rows even when they
-- have no user_id to join on. Rows where neither email nor auth email can be
-- resolved are excluded (coalesce IS NULL) — they cannot be alerted anyway.
--
-- The interface (column names) must stay in sync with MonitorRecord in
-- packages/scoring/src/alerts/store.ts and the supabaseAlertStore.activeMonitors()
-- call that is changing from .from("monitors") to .rpc("active_monitors_with_email").

create or replace function active_monitors_with_email()
returns table (
  id                    uuid,
  target                text,
  email                 text,
  unsubscribe_token     uuid,
  last_notified_run_id  text,
  last_notified_grade   text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    m.id,
    m.target,
    coalesce(m.email::text, u.email)  as email,
    m.unsubscribe_token,
    m.last_notified_run_id,
    m.last_notified_grade
  from monitors m
  left join auth.users u on u.id = m.user_id
  where m.unsubscribed_at is null
    and coalesce(m.email::text, u.email) is not null;
$$;

revoke all on function active_monitors_with_email() from public;
grant execute on function active_monitors_with_email() to service_role, postgres;
