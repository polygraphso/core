-- grade_requests: make email optional and attribute agent-driven requests.
--
-- The original queue was email-gated: a human on the website asks for a grade
-- and we email them when it lands. Agents have no inbox — an MCP client calling
-- request_grade shouldn't be forced to invent an email. So:
--
--   * email becomes NULLABLE. The web funnel still sends an email (notify path);
--     the anonymous CLI/MCP funnel (POST /api/cli/grade-request) may omit it.
--   * new `source` ('web' | 'cli' | 'mcp') records where the request came from.
--   * new `agent_id` records WHO asked when it's an agent — the MCP client's
--     self-reported name/version (e.g. 'claude-ai/1.2.0'), captured from the
--     MCP handshake, not solicited from the user.
--   * dedup splits: one row per (target, email) for humans; one row per target
--     for the email-less agent/anon case, with `request_count` counting repeat
--     asks so the demand signal survives the collapse.
--
-- Append-only. The email-format CHECK already tolerates NULL (a NULL expression
-- is not FALSE, so the constraint passes), so it needs no change.

alter table grade_requests
  alter column email drop not null;

alter table grade_requests
  add column if not exists source text not null default 'web'
    check (source in ('web', 'cli', 'mcp')),
  add column if not exists agent_id text
    check (agent_id is null or char_length(agent_id) <= 200),
  add column if not exists request_count int not null default 1
    check (request_count >= 1),
  add column if not exists last_requested_at timestamptz not null default now();

-- Replace the single (target, email) unique with two partial uniques:
--   * humans: one row per (target, email)
--   * agents/anon: exactly one email-less row per target (repeat asks bump
--     request_count instead of inserting duplicates)
drop index if exists grade_requests_target_email_unique;

create unique index if not exists grade_requests_target_email_unique
  on grade_requests (target, email) where email is not null;

create unique index if not exists grade_requests_target_anon_unique
  on grade_requests (target) where email is null;

-- Rebuild the intake RPC: email optional, source + agent_id captured, and the
-- two dedup paths. Returns { created, demand } like before; demand now sums
-- request_count so repeat agent asks still move the number.
drop function if exists record_grade_request(text, text, text, text);

create or replace function record_grade_request(
  p_target      text,
  p_target_kind text,
  p_email       text default null,
  p_note        text default null,
  p_source      text default 'web',
  p_agent_id    text default null
) returns table (created boolean, demand int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created boolean := false;
begin
  if p_email is not null then
    insert into grade_requests (target, target_kind, email, note, source, agent_id)
    values (p_target, p_target_kind, p_email::citext, p_note, p_source, p_agent_id)
    on conflict (target, email) where email is not null do nothing;
    v_created := found;
  else
    -- Email-less (agent/anon): collapse to one row per target; a repeat ask
    -- bumps request_count and refreshes who/when, rather than inserting a dup.
    insert into grade_requests (target, target_kind, email, note, source, agent_id)
    values (p_target, p_target_kind, null, p_note, p_source, p_agent_id)
    on conflict (target) where email is null do update
      set request_count     = grade_requests.request_count + 1,
          last_requested_at  = now(),
          agent_id           = coalesce(excluded.agent_id, grade_requests.agent_id),
          source             = excluded.source
    returning (xmax = 0) into v_created;
  end if;

  return query
    select v_created,
           (select coalesce(sum(gr.request_count), 0)::int
              from grade_requests gr
              where gr.target = p_target);
end;
$$;

revoke all on function record_grade_request(text, text, text, text, text, text) from public;
grant execute on function record_grade_request(text, text, text, text, text, text)
  to service_role, postgres;
