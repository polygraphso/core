-- Redefine record_monitor with a per-user quota of 1 active monitor.
--
-- In the p_user_id branch only: before insert, check whether the user
-- already has a non-unsubscribed monitor targeting a DIFFERENT server.
-- If so, raise 'quota_exceeded' so the API can return a friendly 409.
-- The exclusion `m.target <> p_target` ensures same-target re-subscribes
-- never trip the quota (that's a reactivation, not a new slot).
-- The email branch is unchanged — anonymous rows are grandfathered uncapped.

create or replace function record_monitor(
  p_target   text,
  p_email    text default null,
  p_user_id  uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id   text;
  v_version  text;
  v_grade    text;
  v_count    int;
begin
  if (p_email is null and p_user_id is null)
     or (p_email is not null and p_user_id is not null) then
    raise exception 'record_monitor: exactly one of p_email or p_user_id must be set';
  end if;

  -- Current published grade for this target, used to seed the watermark so
  -- the first email is about a genuinely newer grade, not the existing one.
  select hr.id::text, hr.resolved_version, hr.grade
    into v_run_id, v_version, v_grade
  from hosted_runs hr
  where hr.target = p_target
    and hr.status = 'complete'
    and hr.published_at is not null
  order by hr.published_at desc
  limit 1;

  if p_email is not null then
    insert into monitors (target, email, last_notified_run_id, last_notified_version, last_notified_grade)
    values (p_target, p_email::citext, v_run_id, v_version, v_grade)
    on conflict (target, email) where email is not null
      do update set unsubscribed_at = null
      where monitors.unsubscribed_at is not null;
  else
    -- Quota: 1 active monitor per user. Same-target re-subscribe is exempt
    -- (m.target <> p_target excludes it from the count).
    select count(*) into v_count
    from monitors m
    where m.user_id = p_user_id
      and m.target <> p_target
      and m.unsubscribed_at is null;

    if v_count >= 1 then
      raise exception 'quota_exceeded'
            using hint = 'Unsubscribe from your current monitor to add a new one.';
    end if;

    insert into monitors (target, user_id, last_notified_run_id, last_notified_version, last_notified_grade)
    values (p_target, p_user_id, v_run_id, v_version, v_grade)
    on conflict (target, user_id) where user_id is not null
      do update set unsubscribed_at = null
      where monitors.unsubscribed_at is not null;
  end if;
end;
$$;

revoke all on function record_monitor(text, text, uuid) from public;
grant execute on function record_monitor(text, text, uuid) to service_role, postgres;
