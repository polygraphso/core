-- At most one queued/running orchestrator-level run at a time. Prevents the
-- SELECT-then-INSERT race in /api/admin/rescore (two near-simultaneous POSTs
-- both pass the "active?" check and start parallel runs against the same
-- seed). Partial so per-version runs (litmus probes etc.) are unaffected.
--
-- Violations surface as Postgres error 23505; the rescore route maps that
-- back to a 409 with the already-active run_id.

create unique index if not exists runs_one_active_orchestrator_idx
  on runs (kind)
  where version_id is null and status in ('queued', 'running');
