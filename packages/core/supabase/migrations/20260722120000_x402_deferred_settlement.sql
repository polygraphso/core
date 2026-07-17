-- x402 deferred settlement: the agent rail (POST /api/x402/grade-request)
-- verifies the signed payment authorization at request time but settles —
-- actually takes the $1 — only after the grading run produces a grade. A run
-- the harness can't complete (unlaunchable target, credential-gated bin, ...)
-- never charges the payer: the authorization is voided and simply expires
-- onchain. Litmus exiting with D/F is a completed grade, not a failure — it
-- settles like any other grade.
--
-- New grade_request_payments statuses:
--   'authorized'    signed x402 authorization held; run in flight; not charged
--   'settling'      a reconciler claimed the row and is calling the facilitator
--                   (atomic claim so a status poll and the cron can't double-settle)
--   'voided'        run failed — never settled, payer keeps the dollar
--   'settle_failed' grade landed but settlement was no longer possible
--                   (authorization expired / funds moved) — the run is NOT
--                   published and the request is declined, so an unsettled
--                   authorization never buys a grade
alter table grade_request_payments
  drop constraint if exists grade_request_payments_status_check;
alter table grade_request_payments
  add constraint grade_request_payments_status_check
  check (status in ('pending', 'paid', 'expired', 'authorized', 'settling', 'voided', 'settle_failed'));

-- The verified x402 payload + the exact requirements it was signed against,
-- kept verbatim so a later reconciler can hand the facilitator the same pair
-- the client signed. Only rows from the x402 rail carry these.
alter table grade_request_payments
  add column if not exists x402_payload jsonb,
  add column if not exists x402_requirements jsonb;

-- The reconcilers look up open authorizations by status.
create index if not exists grade_request_payments_status_idx
  on grade_request_payments (status)
  where status in ('authorized', 'settling');
