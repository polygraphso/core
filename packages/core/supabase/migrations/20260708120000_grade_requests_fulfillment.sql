-- grade_requests fulfillment linkage: the hourly fulfillment job (core
-- packages/scoring, .github/workflows/fulfill.yml) enqueues a hosted_runs row
-- per queued request and needs to find it again on the next pass to reconcile
-- (complete on publish, decline on failure). Link the request to its run.
--
-- Append-only. The queue itself and its statuses are unchanged; 'in_progress'
-- now means "linked to a hosted run and waiting on it".

alter table grade_requests
  add column if not exists hosted_run_id uuid;

-- Reconcile pass: fetch all in_progress rows each hour.
create index if not exists grade_requests_in_progress_idx
  on grade_requests (id) where status = 'in_progress';
