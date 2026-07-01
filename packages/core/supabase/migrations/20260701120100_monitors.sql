-- monitors + alert_deliveries: the new-version regrade alert loop.
--
-- A developer subscribes to a server (email + ref) on polygraph.so/monitor. When
-- that server publishes a new version, the alert engine
-- (packages/scoring/src/scoring/alerts.ts, run hourly by .github/workflows/alerts.yml)
-- enqueues a free regrade (a hosted_runs row with source='monitor'; the runner
-- grades + auto-publishes it), then notices the freshly published grade and emails
-- the watcher.
--
-- Schema mirrors notify_requests (20260521120000): email XOR user_id, idempotent
-- per (target, identity), PII so service-role only — the routes at
-- web/app/api/monitor/{route,unsubscribe/route}.ts are the sole writers.
--
-- v1 scope is npm/pypi registry refs (the only targets with a version stream); the
-- subscribe route rejects remote/github refs so no monitor is created that can
-- never fire.

create extension if not exists "citext";

create table if not exists monitors (
  id            uuid primary key default gen_random_uuid(),

  -- versionless server_key form ({registry}/{name} or {registry}/{owner}/{name}),
  -- the same normalization /api/notify and hosted_runs.target use.
  target        text not null,
  target_kind   text not null default 'registry_ref'
                check (target_kind in ('registry_ref')),

  email         citext,
  user_id       uuid references auth.users(id) on delete cascade,

  -- One-click unsubscribe: the alert email links to
  -- /api/monitor/unsubscribe?token=<unsubscribe_token>.
  unsubscribe_token uuid not null default gen_random_uuid(),
  unsubscribed_at   timestamptz,

  created_at    timestamptz not null default now(),

  -- Watermark. last_notified_run_id is the DEDUP KEY: the hosted_runs.id of the
  -- published grade we last told this watcher about (initialized at subscribe to
  -- the currently published grade so we don't email about the already-current
  -- version). The other three are display/audit only — the email body renders
  -- "was {grade} → now {grade}".
  last_notified_run_id  text,
  last_notified_version text,
  last_notified_grade   text,
  last_notified_at      timestamptz,

  -- Exactly one identity per row (notify_requests parity). Anonymous → email set;
  -- signed-in (future) → user_id set.
  constraint monitors_identity_xor check (
    (email is not null and user_id is null)
    or (email is null and user_id is not null)
  ),

  constraint monitors_email_format check (
    email is null
    or (
      char_length(email::text) between 3 and 254
      and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
    )
  ),

  constraint monitors_target_len check (char_length(target) between 1 and 512)
);

-- Idempotency: one subscription per (target, identity). Partial indexes so the two
-- identity modes don't collide on shared NULLs (notify_requests parity).
create unique index if not exists monitors_anon_unique
  on monitors (target, email) where email is not null;

create unique index if not exists monitors_user_unique
  on monitors (target, user_id) where user_id is not null;

-- Engine read patterns: active monitors (the enqueue + reconcile passes) and the
-- token lookup the unsubscribe route does.
create index if not exists monitors_active_target_idx
  on monitors (target) where unsubscribed_at is null;

create unique index if not exists monitors_unsubscribe_token_idx
  on monitors (unsubscribe_token);

alter table monitors enable row level security;

grant all on table public.monitors to service_role, postgres;

-- alert_deliveries: the send log AND the double-email defense. The reconcile pass
-- claims a (monitor, run) by inserting here (on conflict do nothing) before
-- sending, so two overlapping cron runs can never both email — the second insert
-- hits the unique index and no-ops.
create table if not exists alert_deliveries (
  id                uuid primary key default gen_random_uuid(),
  monitor_id        uuid not null references monitors(id) on delete cascade,
  hosted_run_id     text not null,
  target            text not null,
  version           text,
  grade             text,
  email             citext not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'sent', 'failed')),
  resend_message_id text,
  error             text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,

  -- THE dedup key: at most one delivery per (monitor, published grade row).
  unique (monitor_id, hosted_run_id)
);

create index if not exists alert_deliveries_monitor_idx
  on alert_deliveries (monitor_id);

alter table alert_deliveries enable row level security;

grant all on table public.alert_deliveries to service_role, postgres;

-- Atomic subscribe. Idempotent per (target, identity): a fresh subscribe inserts
-- and initializes the watermark to the currently published grade (so the watcher
-- is not emailed about the version that was already live when they subscribed); a
-- re-subscribe of a previously-unsubscribed row reactivates it; a re-subscribe of
-- an active row is a true no-op. Pass exactly one of (p_email, p_user_id).
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
begin
  if (p_email is null and p_user_id is null)
     or (p_email is not null and p_user_id is not null) then
    raise exception 'record_monitor: exactly one of p_email or p_user_id must be set';
  end if;

  -- Current published grade for this target (the latest live row), used to seed
  -- the watermark so the first email is about a genuinely newer grade.
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
