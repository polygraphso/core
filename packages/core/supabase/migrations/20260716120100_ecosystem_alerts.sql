-- ecosystem alerts: per-ecosystem monitoring strategy + weekly digest plumbing.
--
-- An ecosystem admin configures ONE strategy for the ecosystem they co-own (like
-- page_config / visibility, this is an ecosystem-wide property, not a per-user
-- subscription — that is the separate `monitors` model). A weekly job composes
-- one digest per recipient covering, per the strategy's toggles: CVEs to fix,
-- grade drops, and new-version regrades across the ecosystem's entries.
--
--   ecosystem_alert_settings    — one row per ecosystem: the strategy.
--   ecosystem_alert_recipients  — one row per (ecosystem, email): each person's
--                                 own one-click unsubscribe token (no list leak).
--   ecosystem_entry_alert_state — grade-drop / new-version watermark per entry.
--   ecosystem_alert_deliveries  — send log + weekly dedup.
--
-- Written only by the service-role client (web /api/manage/[slug]/alerts routes +
-- the packages/scoring ecosystem-alerts job); RLS is a default-deny backstop.

create extension if not exists "citext";

-- ----------------------------------------------------------------------------
-- ecosystem_alert_settings: the strategy, one row per ecosystem. Absent row =
-- defaults (the web layer returns defaults and upserts on first save).
-- ----------------------------------------------------------------------------
create table if not exists ecosystem_alert_settings (
  ecosystem_id        uuid primary key references ecosystems(id) on delete cascade,

  cve_enabled         boolean not null default true,
  cve_min_severity    text not null default 'HIGH'
                      check (cve_min_severity in ('CRITICAL', 'HIGH', 'MODERATE', 'LOW')),
  grade_drop_enabled  boolean not null default true,
  new_version_enabled boolean not null default true,

  -- Global cadence switch; 'off' mutes the digest while the category toggles are
  -- preserved. (Weekly is the only live cadence in v1.)
  frequency           text not null default 'weekly' check (frequency in ('weekly', 'off')),

  -- Who receives the digest. 'admins'/'members' resolve live from
  -- ecosystem_members at send time; 'explicit' uses the hand-added recipient rows.
  recipients_mode     text not null default 'admins'
                      check (recipients_mode in ('admins', 'members', 'explicit')),

  last_cve_sent_at    timestamptz,
  last_digest_period  text,   -- ISO-week watermark, e.g. "2026-W28"

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table ecosystem_alert_settings enable row level security;
grant all on table public.ecosystem_alert_settings to service_role, postgres;

-- ----------------------------------------------------------------------------
-- ecosystem_alert_recipients: one row per (ecosystem, email). For 'admins' /
-- 'members' modes the job lazily inserts a `source='auto'` row per resolved
-- person purely to mint a stable unsubscribe token; `source='explicit'` rows are
-- hand-added addresses. Each person unsubscribes independently — the digest is
-- sent one recipient at a time, never CC/BCC'd.
-- ----------------------------------------------------------------------------
create table if not exists ecosystem_alert_recipients (
  id                uuid primary key default gen_random_uuid(),
  ecosystem_id      uuid not null references ecosystems(id) on delete cascade,

  email             citext not null,
  user_id           uuid references auth.users(id) on delete set null,

  unsubscribe_token uuid not null default gen_random_uuid(),
  unsubscribed_at   timestamptz,

  source            text not null default 'explicit' check (source in ('auto', 'explicit')),

  created_at        timestamptz not null default now(),

  unique (ecosystem_id, email),

  constraint ecosystem_alert_recipients_email_format check (
    char_length(email::text) between 3 and 254
    and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  )
);

create unique index if not exists ecosystem_alert_recipients_token_idx
  on ecosystem_alert_recipients (unsubscribe_token);
create index if not exists ecosystem_alert_recipients_active_idx
  on ecosystem_alert_recipients (ecosystem_id) where unsubscribed_at is null;

alter table ecosystem_alert_recipients enable row level security;
grant all on table public.ecosystem_alert_recipients to service_role, postgres;

-- ----------------------------------------------------------------------------
-- ecosystem_entry_alert_state: grade-drop / new-version watermark, one row per
-- entry. Side table so ecosystem_entries stays untouched; the watermark advances
-- only after a digest that reported the change is successfully sent, so each
-- change surfaces exactly once.
-- ----------------------------------------------------------------------------
create table if not exists ecosystem_entry_alert_state (
  entry_id          uuid primary key references ecosystem_entries(id) on delete cascade,
  last_seen_run_id  text,
  last_seen_grade   text,
  last_seen_version text,
  updated_at        timestamptz not null default now()
);

alter table ecosystem_entry_alert_state enable row level security;
grant all on table public.ecosystem_entry_alert_state to service_role, postgres;

-- ----------------------------------------------------------------------------
-- ecosystem_alert_deliveries: send log + dedup. The (recipient_id, period_key)
-- unique constraint caps sends at one digest per recipient per ISO week, so two
-- overlapping cron runs can never both email (claim_ecosystem_delivery below).
-- ----------------------------------------------------------------------------
create table if not exists ecosystem_alert_deliveries (
  id                uuid primary key default gen_random_uuid(),
  ecosystem_id      uuid not null references ecosystems(id) on delete cascade,
  recipient_id      uuid not null references ecosystem_alert_recipients(id) on delete cascade,

  period_key        text not null,   -- ISO week, e.g. "2026-W28"
  kind              text not null default 'digest',

  email             citext not null,
  status            text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  resend_message_id text,
  error             text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,

  unique (recipient_id, period_key)
);

create index if not exists ecosystem_alert_deliveries_ecosystem_idx
  on ecosystem_alert_deliveries (ecosystem_id);

alter table ecosystem_alert_deliveries enable row level security;
grant all on table public.ecosystem_alert_deliveries to service_role, postgres;

-- ----------------------------------------------------------------------------
-- claim_ecosystem_delivery: atomic insert-or-retry, modeled 1:1 on
-- claim_or_retry_delivery. Insert 'pending' → return the id; a 'failed' row is
-- reset for retry; a 'sent'/'pending' row leaves DO UPDATE's WHERE false so
-- RETURNING yields nothing → caller gets null → skip.
-- ----------------------------------------------------------------------------
create or replace function claim_ecosystem_delivery(
  p_recipient_id uuid,
  p_period_key   text,
  p_ecosystem_id uuid,
  p_email        text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into ecosystem_alert_deliveries (
    ecosystem_id, recipient_id, period_key, email, status
  ) values (
    p_ecosystem_id, p_recipient_id, p_period_key, p_email::citext, 'pending'
  )
  on conflict (recipient_id, period_key)
  do update
    set status            = 'pending',
        error             = null,
        resend_message_id = null,
        sent_at           = null
    where ecosystem_alert_deliveries.status = 'failed'
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function claim_ecosystem_delivery(uuid, text, uuid, text) from public;
grant execute on function claim_ecosystem_delivery(uuid, text, uuid, text) to service_role, postgres;
