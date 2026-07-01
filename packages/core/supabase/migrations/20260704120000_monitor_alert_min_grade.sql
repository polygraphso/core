-- Per-monitor alert threshold: only email when the NEW published grade is bad
-- enough. NULL (the default) preserves today's behavior — an email on every
-- new-version regrade. Otherwise the alert engine emails only when the new
-- grade is at or below this letter on the A>B>C>D>F severity scale.
--
-- Stored as the letter (not an ordinal) to match every other grade column in
-- the DB (hosted_runs.grade, alert_deliveries.grade, monitors.last_notified_grade
-- are all bare text). The CHECK is the DB's first grade constraint — following
-- the house `text + CHECK in (...)` style (there are no PG enum types here).
-- There is deliberately no 'B' option: "every regrade" (NULL) already covers
-- B-and-below. Grades are A,B,C,D,F — there is no 'E'.

alter table monitors
  add column alert_min_grade text
  check (alert_min_grade is null or alert_min_grade in ('C', 'D', 'F'));

-- Re-create active_monitors_with_email() to surface the new column. The alert
-- engine reads monitors ONLY through this RPC (packages/scoring/src/alerts/store.ts
-- → .rpc("active_monitors_with_email")), so the threshold has to travel with it.
-- Body/joins/filters are unchanged from 20260702120100 except the added column.
-- Adding a column to the RETURNS TABLE changes the return type, which
-- CREATE OR REPLACE cannot do — drop first.
drop function if exists active_monitors_with_email();

create function active_monitors_with_email()
returns table (
  id                    uuid,
  target                text,
  email                 text,
  unsubscribe_token     uuid,
  last_notified_run_id  text,
  last_notified_grade   text,
  alert_min_grade       text
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
    m.last_notified_grade,
    m.alert_min_grade
  from monitors m
  left join auth.users u on u.id = m.user_id
  where m.unsubscribed_at is null
    and coalesce(m.email::text, u.email) is not null;
$$;

revoke all on function active_monitors_with_email() from public;
grant execute on function active_monitors_with_email() to service_role, postgres;

-- Write path for the dashboard: set a user's OWN monitor's alert threshold.
-- p_min_grade is one of 'C','D','F' or NULL ("every regrade"). Ownership is
-- enforced in the DB via the (id, user_id) match — a monitor the caller does
-- not own updates zero rows, so the service-role route handler can't be tricked
-- into an IDOR. Dedicated RPC rather than overloading record_monitor (the
-- subscribe/quota path) — a different concern.
create or replace function set_monitor_alert_grade(
  p_monitor_id uuid,
  p_user_id    uuid,
  p_min_grade  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_min_grade is not null and p_min_grade not in ('C', 'D', 'F') then
    raise exception 'set_monitor_alert_grade: invalid grade %', p_min_grade;
  end if;

  update monitors
     set alert_min_grade = p_min_grade
   where id = p_monitor_id
     and user_id = p_user_id;
end;
$$;

revoke all on function set_monitor_alert_grade(uuid, uuid, text) from public;
grant execute on function set_monitor_alert_grade(uuid, uuid, text) to service_role, postgres;
