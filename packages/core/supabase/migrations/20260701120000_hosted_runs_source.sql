-- hosted_runs.source: what enqueued this grade row. NULLABLE with no default —
-- NULL means "untagged" (every existing row, the paid HTTP/queue flow, curated
-- publishes, admin regrades: none are re-labeled). The ONLY value with special
-- semantics is 'monitor' — a free, system-enqueued regrade triggered when a watched
-- server publishes a new version (the new-version alert loop). The claim function
-- reads it to make 'monitor' rows claimable without paid_at, and the runner's worker
-- auto-publishes them.
--
-- Deliberately NOT `default 'paid'`: the payment signal is `paid_at`, not `source`,
-- so tagging a curated/admin/on-demand row 'paid' (while paid_at is null) would be a
-- self-contradiction. NULL is the honest default; producers can be tagged explicitly
-- later if a taxonomy is ever needed.
--
-- CROSS-REPO CONTRACT — this column is read by two files in hosted-service:
--   deploy/db/claim_next_hosted_run.sql      (claim eligibility + paid-first order)
--   packages/runner/src/worker.ts            (source='monitor' → auto-publish branch)
-- Apply THIS migration BEFORE either of those ships. If the claim function ships
-- first, `source` is referenced before it exists and every claim errors — the whole
-- queue stalls, paid grades included.

alter table hosted_runs
  add column if not exists source text;

-- The alert enqueuer guards against a duplicate in-flight regrade for a target
-- before inserting one. A monitor row is enqueued versionless (resolved_version is
-- stamped at grade time), so the guard keys on target alone.
create index if not exists hosted_runs_monitor_inflight_idx
  on hosted_runs (target)
  where source = 'monitor' and status in ('queued', 'running');
