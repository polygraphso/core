-- behavioral_grades: published litmus-v1 grades for tracked servers — the
-- table behind `polygraph` in /api/cli/check and /api/cli/list.
--
-- This is the PUBLIC-grades contract (the hosted_runs table is the paid
-- per-run contract; this one is what the lookup serves). Writers today:
-- Ruben, populating the first grades manually; later the infra worker
-- publishes reviewed results here.
--
-- Shape updates core-contracts.md's original sketch to litmus reality:
-- grades are A / B / D / F (no C — litmus-test-v1 §5), and a grade
-- carries the per-check outcomes, the tool-surface fingerprint, and the
-- methodology version that produced it.
--
-- Per-run history is a feature: one row per (version, run); the routes
-- read latest-per-version by computed_at. Re-tests append, never update.
--
-- Manual population recipe (Ruben):
--   insert into behavioral_grades
--     (version_id, grade, c01, c02, c03, tool_defs_fingerprint,
--      methodology_version, rationale, evidence_url)
--   select s.latest_version_id, 'B', 'pass', 'skipped', 'pass',
--          '0x…64hex…', 'litmus-v1',
--          'Egress unverified on a remote target; capped at B by design.',
--          'https://…evidence…'
--   from servers s
--   where s.registry = 'npm' and s.owner = '@modelcontextprotocol'
--     and s.name = 'server-filesystem';
--
-- Publication discipline (hosted-service-brief.md): failing grades on
-- servers the requester doesn't own go through vendor-first disclosure
-- BEFORE a row lands here. This table is the public record.

create table if not exists behavioral_grades (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references versions(id) on delete cascade,

  grade         text not null check (grade in ('A', 'B', 'D', 'F')),
  c01           text check (c01 in ('pass', 'fail', 'skipped', 'partial')),
  c02           text check (c02 in ('pass', 'fail', 'skipped', 'partial')),
  c03           text check (c03 in ('pass', 'fail', 'skipped', 'partial')),

  -- Detailed per-probe findings (severity, matches, offsets) — the
  -- evidence bundle's findings section, when available.
  probe_results jsonb,

  tool_defs_fingerprint text,
  methodology_version   text not null default 'litmus-v1',
  rationale             text,
  evidence_url          text,

  computed_at   timestamptz not null default now()
);

-- "Latest grade per version" — the only read pattern the routes use.
create index if not exists behavioral_grades_version_latest_idx
  on behavioral_grades (version_id, computed_at desc);

alter table behavioral_grades enable row level security;

grant all on table public.behavioral_grades to service_role, postgres;
