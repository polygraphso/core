-- Payment-rail decoupling for hosted_runs (hosted-service-brief.md).
--
-- The Stripe-vs-onchain decision is open; this makes it config instead
-- of schema. payment_tx stays (it's the USDC rail's reference and the
-- existing replay guard); payment_ref generalizes it for other rails
-- (e.g. a Stripe checkout-session id), with the same one-ref-one-run
-- uniqueness.

alter table hosted_runs
  add column if not exists payment_provider text
    check (payment_provider in ('usdc_base', 'stripe')),
  add column if not exists payment_ref text;

-- One external payment reference pays for exactly one run, per provider.
create unique index if not exists hosted_runs_payment_ref_unique
  on hosted_runs (payment_provider, payment_ref)
  where payment_ref is not null;

-- Backfill any already-paid rows (pre-decoupling these were all USDC).
update hosted_runs
  set payment_provider = 'usdc_base', payment_ref = payment_tx
  where payment_tx is not null and payment_provider is null;
