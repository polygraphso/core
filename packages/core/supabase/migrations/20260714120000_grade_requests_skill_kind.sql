-- Admit 'skill' as a grade-request kind. A github skill target (a SKILL.md URL
-- or a canonical github/owner/repo#path) is queued with target_kind='skill' so
-- the runner routes it to the skill grader instead of trying to launch it as an
-- MCP server. Without this, parseGradeTarget's new skill classification would be
-- rejected by the table CHECK and the request would fail to enqueue.
--
-- Mirrors the monitors widening in 20260712120000_commit_anchor.sql. github
-- *servers* stay 'registry_ref' (a github/owner/repo ref is not an https URL),
-- so only skills need the new kind. hosted_runs already accepts 'skill'.
alter table grade_requests drop constraint if exists grade_requests_target_kind_check;
alter table grade_requests
  add constraint grade_requests_target_kind_check
  check (target_kind in ('registry_ref', 'remote_url', 'skill'));
