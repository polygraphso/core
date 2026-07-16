-- Track the hosted-runner job that a paid grade request kicked off, so the
-- status endpoint can poll it and publish the grade when it completes. Set
-- best-effort right after payment (the request stays paid either way; the
-- hourly fulfillment cron is the backstop when the immediate enqueue can't
-- run). runner_job_id is the runner's in-memory HTTP job id (POST /grade),
-- distinct from hosted_runs.id, which is stamped onto hosted_run_id once the
-- run completes.
alter table grade_requests add column if not exists runner_job_id text;
alter table grade_requests add column if not exists runner_started_at timestamptz;
