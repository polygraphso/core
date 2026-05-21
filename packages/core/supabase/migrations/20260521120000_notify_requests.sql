-- notify_requests: per-server notify funnel writes. The CLI deep-links
-- untracked-server lookups to polygraph.so/notify?for=<server_ref>, which
-- POSTs here. PII (email / user_id), so service-role only; the Next.js
-- route at web/app/api/notify/route.ts is the sole writer.
--
-- Schema follows core-contracts.md §"API surface" + the notify_requests
-- table sketch. Idempotency target per the brief: re-submitting the same
-- (server_ref, email) or (server_ref, user_id) is a no-op, returns ok.
--
-- server_id stays null until the server enters the tracked set; the
-- fulfillment worker (see scoring-brief.md "Notify-funnel fulfillment")
-- backfills the link and sends the one-shot email.

create extension if not exists "citext";

create table if not exists notify_requests (
  id            uuid primary key default gen_random_uuid(),
  server_ref    text not null,
  server_id     uuid references servers(id) on delete set null,
  email         citext,
  user_id       uuid references auth.users(id) on delete cascade,
  requested_at  timestamptz not null default now(),
  fulfilled_at  timestamptz,

  -- Exactly one identity per row. Anonymous → email set, user_id null.
  -- Signed-in → user_id set, email null (resolved server-side from session).
  constraint notify_requests_identity_xor check (
    (email is not null and user_id is null)
    or (email is null and user_id is not null)
  ),

  -- Same email/length guard as waitlist_signups — DB-level backstop
  -- behind the API regex.
  constraint notify_requests_email_format check (
    email is null
    or (
      char_length(email::text) between 3 and 254
      and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
    )
  ),

  constraint notify_requests_server_ref_len check (
    char_length(server_ref) between 1 and 512
  )
);

-- Idempotency: one row per (server_ref, identity). Partial indexes so the
-- two identity modes don't collide on shared NULLs.
create unique index if not exists notify_requests_anon_unique
  on notify_requests (server_ref, email)
  where email is not null;

create unique index if not exists notify_requests_user_unique
  on notify_requests (server_ref, user_id)
  where user_id is not null;

-- Fulfillment-worker read patterns: outstanding rows by server_ref
-- (anonymous) or by server_id (once linked), filtered to unfulfilled.
create index if not exists notify_requests_unfulfilled_ref_idx
  on notify_requests (server_ref) where fulfilled_at is null;

create index if not exists notify_requests_unfulfilled_server_id_idx
  on notify_requests (server_id) where fulfilled_at is null and server_id is not null;

create index if not exists notify_requests_fulfilled_at_idx
  on notify_requests (fulfilled_at);

alter table notify_requests enable row level security;

grant all on table public.notify_requests to service_role, postgres;

-- Atomic upsert. The route calls this via supabase.rpc() so the unique-
-- index conflict + (future) server_id backfill happen in one round-trip.
-- Pass exactly one of (p_email, p_user_id); the function enforces XOR.
--
-- Returns void: the API contract is {ok: true} regardless of insert-vs-
-- noop, so the caller doesn't need to distinguish.
--
-- security definer + revoke-from-public: only service_role can execute.

create or replace function record_notify_request(
  p_server_ref text,
  p_email      text default null,
  p_user_id    uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_server_id uuid;
begin
  if (p_email is null and p_user_id is null)
     or (p_email is not null and p_user_id is not null) then
    raise exception 'record_notify_request: exactly one of p_email or p_user_id must be set';
  end if;

  -- Best-effort link to a tracked server. Versionless server_key form
  -- ({registry}/{name} or {registry}/{owner}/{name}), matching what
  -- /api/cli/check passes through. Misses leave server_id null; the
  -- fulfillment worker reconciles later.
  select s.id into v_server_id
  from servers s
  where p_server_ref = case
    when s.owner is null then s.registry || '/' || s.name
    else s.registry || '/' || s.owner || '/' || s.name
  end
  limit 1;

  if p_email is not null then
    insert into notify_requests (server_ref, server_id, email)
    values (p_server_ref, v_server_id, p_email::citext)
    on conflict (server_ref, email) where email is not null do nothing;
  else
    insert into notify_requests (server_ref, server_id, user_id)
    values (p_server_ref, v_server_id, p_user_id)
    on conflict (server_ref, user_id) where user_id is not null do nothing;
  end if;
end;
$$;

revoke all on function record_notify_request(text, text, uuid) from public;
grant execute on function record_notify_request(text, text, uuid) to service_role, postgres;
