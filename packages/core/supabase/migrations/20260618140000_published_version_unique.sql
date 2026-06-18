-- Versioned identity: allow multiple graded VERSIONS of one server to be
-- published at once (so npm/foo@1 and npm/foo@2 each keep a live grade and are
-- looked up per version), while still guaranteeing at most ONE published grade
-- per (server, version). Pairs with the runner's per-version unpublishPrevious.
--
-- `resolved_version` is null for versionless/remote targets; NULLS NOT DISTINCT
-- (PG15+) makes the constraint also enforce "one published null-version row per
-- target", matching the previous one-published-per-versionless-target behavior.
-- Partial: only published rows are constrained — historical/unpublished rows are
-- free to duplicate.
--
-- PRE-APPLY CHECK: this index fails to build if duplicate published
-- (target, resolved_version) rows already exist. Under the prior whole-target
-- unpublish there is at most one published row per target, so none are expected,
-- but verify before applying:
--   select target, resolved_version, count(*)
--   from hosted_runs where published_at is not null
--   group by target, resolved_version having count(*) > 1;

create unique index if not exists hosted_runs_published_version_uidx
  on hosted_runs (target, resolved_version)
  nulls not distinct
  where published_at is not null;
