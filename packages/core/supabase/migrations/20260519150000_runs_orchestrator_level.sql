-- Allow runs rows to represent an orchestrator-level invocation (whole
-- population) rather than only per-version work. The original schema had
-- runs.version_id NOT NULL, modelling each row as one (version, kind) probe.
-- A scoring orchestrator pass covers every tracked server, so there's no
-- single version_id to attach — it's a population-level event.
--
-- Make version_id nullable. The scoring orchestrator now writes one row
-- with (version_id=NULL, kind='scoring'); per-version rows can still be
-- written by future per-version probes (e.g. litmus runs).
--
-- The /admin dashboard reads the orchestrator-level row to show the most
-- recent scoring run status (queued / running / completed / failed).

alter table runs
  alter column version_id drop not null;

-- Index for the dashboard's "latest scoring orchestrator run" lookup.
-- Partial on version_id IS NULL so it only covers orchestrator-level rows.
create index if not exists runs_latest_orchestrator_idx
  on runs (kind, started_at desc)
  where version_id is null;
