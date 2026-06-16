-- grade_requests: the public "grade this server" queue.
--
-- Anyone can ask us to run the litmus battery on a server they care
-- about. Free, email-gated (so we can tell them when it lands and so the
-- queue isn't anonymous spam). Rúben drains the queue manually for now:
-- pick the oldest / highest-demand 'queued' row, run the harness, publish
-- the grade through the normal path, mark the request 'completed'.
--
-- This is THE intake queue. The later burn-to-skip feature (paying
-- $POLYGRAPH to jump the line) adds priority to THIS table — it does not
-- introduce a second queue.
--
-- PII (email), so service-role only; the Next.js route at
-- web/app/api/grade-requests/route.ts is the sole writer.

create extension if not exists "citext";

create table if not exists grade_requests (
  id            uuid primary key default gen_random_uuid(),

  -- registry ref (npm/… | pypi/… | github/…), normalized to the
  -- versionless server_key form, or a remote https:// MCP URL.
  target        text not null,
  target_kind   text not null check (target_kind in ('registry_ref', 'remote_url')),

  email         citext not null,
  note          text,

  status        text not null default 'queued'
                check (status in ('queued', 'in_progress', 'completed', 'declined')),

  requested_at  timestamptz not null default now(),
  fulfilled_at  timestamptz,

  constraint grade_requests_target_len check (char_length(target) between 1 and 512),
  constraint grade_requests_note_len check (note is null or char_length(note) <= 2000),
  constraint grade_requests_email_format check (
    char_length(email::text) between 3 and 254
    and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  )
);

-- One request per (target, email): resubmitting is a no-op, not a dup.
create unique index if not exists grade_requests_target_email_unique
  on grade_requests (target, email);

-- Queue drain: oldest queued first.
create index if not exists grade_requests_queue_idx
  on grade_requests (requested_at) where status = 'queued';

-- Demand signal: count distinct requesters per target.
create index if not exists grade_requests_target_idx
  on grade_requests (target);

alter table grade_requests enable row level security;

grant all on table public.grade_requests to service_role, postgres;

-- Idempotent insert. Returns whether this call created a new row and the
-- current demand for the target (distinct request rows), so the UI can
-- say "you're on the bench — N people have asked for this."
create or replace function record_grade_request(
  p_target      text,
  p_target_kind text,
  p_email       text,
  p_note        text default null
) returns table (created boolean, demand int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created boolean := false;
begin
  insert into grade_requests (target, target_kind, email, note)
  values (p_target, p_target_kind, p_email::citext, p_note)
  on conflict (target, email) do nothing;

  -- FOUND is true only when the insert actually wrote a row (conflict →
  -- DO NOTHING affects zero rows → FOUND false).
  v_created := found;

  return query
    select v_created, (select count(*)::int from grade_requests gr where gr.target = p_target);
end;
$$;

revoke all on function record_grade_request(text, text, text, text) from public;
grant execute on function record_grade_request(text, text, text, text) to service_role, postgres;
