-- user plan payments: the POLYGRAPH-stream payment record behind per-user
-- monitor quotas (Pro plans).
--
-- A user lifts the free 1-monitor cap by creating a cancelable monthly Sablier
-- Lockup stream of $POLYGRAPH to the polygraph treasury on Base — exactly the
-- ecosystem_payments rail (20260717120000) keyed by user instead of ecosystem,
-- plus a `plan` naming what was bought. The web verify route reads the stream
-- onchain from its creation tx and inserts one row here; record_monitor and the
-- dashboard treat the user as on `plan` while a row is status='active' with
-- end_at in the future. Onchain cancellation is reconciled lazily by the web
-- layer (statusOf, hourly); expiry is enforced here (end_at).
--
-- Written only by the service-role client; RLS is a default-deny backstop.

create table if not exists user_plan_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  plan             text not null check (plan in ('indie', 'team')),

  -- Where the stream lives.
  chain_id         integer not null,
  sablier_contract text not null,     -- SablierLockup address the stream was created on
  stream_id        numeric not null,  -- Lockup streamId (uint256)
  tx_hash          text,              -- create tx, as reported by the client

  -- What was committed, denominated both ways.
  token            text not null,     -- ERC-20 address ($POLYGRAPH)
  token_decimals   integer not null,
  deposit_amount   numeric not null,  -- raw token units (uint128)
  usd_monthly      numeric not null,  -- price charged, USD/month
  usd_total        numeric not null,  -- usd_monthly × term
  token_usd_rate   numeric not null,  -- token price used at verification time

  payer_address    text not null,     -- stream sender (any wallet; gifting a plan is fine)
  start_at         timestamptz not null,
  end_at           timestamptz not null,

  status           text not null default 'active'
                   check (status in ('active', 'canceled', 'ended')),

  verified_at      timestamptz not null default now(),
  last_checked_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  unique (chain_id, sablier_contract, stream_id)
);

create index if not exists user_plan_payments_user_status_idx
  on user_plan_payments (user_id, status);

alter table user_plan_payments enable row level security;
grant all on table public.user_plan_payments to service_role, postgres;

-- Redefine record_monitor: the quota now reads the buyer's active plan.
-- Supersedes the definition in 20260712120000_commit_anchor.sql — same 4-arg
-- signature, create or replace (no drop, zero-downtime, existing grants kept).
-- Free stays at 1 active monitor; an active plan row lifts it to 25 (indie) /
-- 100 (team); admins stay uncapped. The numbers are duplicated in
-- web/lib/paymentConfig.ts PLAN_QUOTAS (render side) — change both together.
-- Behavior is identical until a user_plan_payments row exists.
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
  v_quota     int;
  v_plan      text;
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
    -- Quota by plan, EXCEPT admins (uncapped). Same-target re-subscribe is
    -- exempt for everyone (m.target <> p_target excludes it). A missing
    -- profile row leaves v_is_admin null → treated as non-admin.
    select is_admin into v_is_admin
    from profiles
    where id = p_user_id;

    if not coalesce(v_is_admin, false) then
      -- Newest live plan row wins. DB-side expiry only (end_at): the web layer
      -- reconciles onchain cancellation via getUserPlan() before enforcement.
      select upp.plan into v_plan
      from user_plan_payments upp
      where upp.user_id = p_user_id
        and upp.status = 'active'
        and upp.end_at > now()
      order by upp.verified_at desc
      limit 1;

      v_quota := case v_plan when 'indie' then 25 when 'team' then 100 else 1 end;

      select count(*) into v_count
      from monitors m
      where m.user_id = p_user_id
        and m.target <> p_target
        and m.unsubscribed_at is null;

      if v_count >= v_quota then
        raise exception 'quota_exceeded'
              using hint = 'Upgrade your plan for more monitor slots, or unsubscribe from an existing monitor.';
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
