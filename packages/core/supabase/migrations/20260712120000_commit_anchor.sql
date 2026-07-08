-- Commit anchor: give GitHub-sourced grades a "version stream" so skills and
-- GitHub MCP servers can be continuously monitored the way npm/pypi already are.
--
-- npm/pypi targets have a registry version stream the alert engine watches. Skills
-- (github/owner/repo#path) and GitHub servers (github/owner/repo) do not — so the
-- /monitor route turned them away. Their natural version stream is the Git commit
-- that produced the graded bytes. This migration records that commit on every grade
-- and opens monitoring to the two GitHub target kinds.
--
--   hosted_runs.commit_sha  — the PATH-SCOPED last commit touching the graded path
--                             (path-scoped, not repo HEAD: a monorepo like
--                             BankrBot/skills holds 157 skills, so a repo-HEAD anchor
--                             would make one skill's commit look like a change to all).
--   hosted_runs.commit_at   — that commit's committer date (when it landed).
--
-- Both are null for npm/pypi/remote targets (they keep their existing streams) and
-- for grades run before this lands (backfilled separately). Distinct from
-- resolved_version (the content/reproducibility pin): the monitor compares commit_sha,
-- never resolved_version.

alter table if exists hosted_runs add column if not exists commit_sha text;
alter table if exists hosted_runs add column if not exists commit_at timestamptz;

-- Admit 'skill' as a monitorable kind. GitHub *servers* are already stored as
-- 'registry_ref' (a github/owner/repo ref is not an https URL), so they need no new
-- kind — only skills, which carry target_kind='skill', do. The subscribe route still
-- rejects remote_url (no commit stream) by never passing it here.
alter table monitors drop constraint if exists monitors_target_kind_check;
alter table monitors
  add constraint monitors_target_kind_check
  check (target_kind in ('registry_ref', 'skill'));

-- Surface target_kind through the engine's only read of monitors. The enqueue pass
-- needs it to route a skill regrade (target_kind='skill' → the worker's skill grader)
-- vs a server regrade. Adding a column to RETURNS TABLE changes the return type, which
-- CREATE OR REPLACE cannot do — drop first. Body unchanged from 20260704120000 except
-- the added column.
drop function if exists active_monitors_with_email();

create function active_monitors_with_email()
returns table (
  id                    uuid,
  target                text,
  target_kind           text,
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
    m.target_kind,
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

-- Redefine record_monitor to carry target_kind onto the inserted monitor row.
-- Supersedes 20260705120000_record_monitor_admin_bypass.sql. New trailing
-- p_target_kind (default 'registry_ref') so existing 3-arg callers keep working;
-- the subscribe route passes 'skill' for skill refs. Drop the 3-arg signature so a
-- 3-arg call resolves unambiguously to this one via the default. Quota/admin-bypass
-- and watermark-seeding logic are otherwise unchanged.
drop function if exists record_monitor(text, text, uuid);

create or replace function record_monitor(
  p_target       text,
  p_email        text default null,
  p_user_id      uuid default null,
  p_target_kind  text default 'registry_ref'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id    text;
  v_version   text;
  v_grade     text;
  v_count     int;
  v_is_admin  boolean;
begin
  if (p_email is null and p_user_id is null)
     or (p_email is not null and p_user_id is not null) then
    raise exception 'record_monitor: exactly one of p_email or p_user_id must be set';
  end if;

  if p_target_kind not in ('registry_ref', 'skill') then
    raise exception 'record_monitor: invalid target_kind %', p_target_kind;
  end if;

  -- Current published grade for this target, used to seed the watermark so the
  -- first email is about a genuinely newer grade, not the existing one.
  select hr.id::text, hr.resolved_version, hr.grade
    into v_run_id, v_version, v_grade
  from hosted_runs hr
  where hr.target = p_target
    and hr.status = 'complete'
    and hr.published_at is not null
  order by hr.published_at desc
  limit 1;

  if p_email is not null then
    insert into monitors (target, target_kind, email, last_notified_run_id, last_notified_version, last_notified_grade)
    values (p_target, p_target_kind, p_email::citext, v_run_id, v_version, v_grade)
    on conflict (target, email) where email is not null
      do update set unsubscribed_at = null
      where monitors.unsubscribed_at is not null;
  else
    -- Quota: 1 active monitor per user, EXCEPT admins (uncapped). Same-target
    -- re-subscribe is exempt for everyone (m.target <> p_target excludes it).
    -- A missing profile row leaves v_is_admin null → treated as non-admin.
    select is_admin into v_is_admin
    from profiles
    where id = p_user_id;

    if not coalesce(v_is_admin, false) then
      select count(*) into v_count
      from monitors m
      where m.user_id = p_user_id
        and m.target <> p_target
        and m.unsubscribed_at is null;

      if v_count >= 1 then
        raise exception 'quota_exceeded'
              using hint = 'Unsubscribe from your current monitor to add a new one.';
      end if;
    end if;

    insert into monitors (target, target_kind, user_id, last_notified_run_id, last_notified_version, last_notified_grade)
    values (p_target, p_target_kind, p_user_id, v_run_id, v_version, v_grade)
    on conflict (target, user_id) where user_id is not null
      do update set unsubscribed_at = null
      where monitors.unsubscribed_at is not null;
  end if;
end;
$$;

revoke all on function record_monitor(text, text, uuid, text) from public;
grant execute on function record_monitor(text, text, uuid, text) to service_role, postgres;
