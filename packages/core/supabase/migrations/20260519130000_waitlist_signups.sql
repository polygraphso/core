-- waitlist_signups: people who signed up on the landing page (hero
-- waitlist form + grades-updates minimal signup). PII (email), so only
-- service-role can read/write; the Next.js API route at
-- web/app/api/waitlist/route.ts is the sole writer.
--
-- Idempotent by email: the same address submitted twice updates
-- last_seen_at + signup_count rather than erroring. Role/source from the
-- most recent submission win, because that's what the user just told us.

create extension if not exists "citext";

create table if not exists waitlist_signups (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null unique,
  role           text,
  source         text,
  signup_count   integer not null default 1,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  -- Defence-in-depth: even though the API validates, the DB rejects
  -- anything that isn't a plausible email or that exceeds RFC-5321's
  -- 254-char practical cap. CHECK runs after the API regex so a bug in
  -- the route can't silently insert junk.
  constraint waitlist_signups_email_format check (
    char_length(email::text) between 3 and 254
    and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  ),
  constraint waitlist_signups_role_check check (
    role is null or role in ('developer','security','founder','researcher','other')
  ),
  constraint waitlist_signups_source_len check (
    source is null or char_length(source) <= 64
  )
);

-- Read patterns: chronological (newest first) and source-based segmentation.
create index if not exists waitlist_signups_first_seen_at_idx
  on waitlist_signups (first_seen_at desc);

create index if not exists waitlist_signups_source_idx
  on waitlist_signups (source) where source is not null;

-- RLS on, no anon/authenticated policies — service-role bypasses RLS, so
-- only the API route (which holds SUPABASE_SERVICE_ROLE_KEY) can touch
-- this table. Default-privileges from 20260518160000_grant_service_role.sql
-- already grants service_role + postgres on tables created after it.
alter table waitlist_signups enable row level security;

-- Atomic upsert. The route calls this via supabase.rpc() so dedupe +
-- counter bump happen in one round-trip and we don't race on duplicate
-- submissions of the same email.
--
-- security definer is fine here because (a) only service_role can execute,
-- (b) the function only writes to waitlist_signups, and (c) all inputs are
-- bound parameters — no dynamic SQL, so no injection surface.

create or replace function record_waitlist_signup(
  p_email  text,
  p_role   text default null,
  p_source text default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into waitlist_signups (email, role, source)
  values (p_email::citext, nullif(p_role, ''), nullif(p_source, ''))
  on conflict (email) do update
  set signup_count = waitlist_signups.signup_count + 1,
      last_seen_at = now(),
      role         = coalesce(nullif(excluded.role, ''),  waitlist_signups.role),
      source       = coalesce(nullif(excluded.source, ''), waitlist_signups.source);
$$;

revoke all on function record_waitlist_signup(text, text, text) from public;
grant execute on function record_waitlist_signup(text, text, text) to service_role, postgres;
