-- Add 'stopped' to the payment-status vocabulary of both stream-payment
-- tables. 'stopped' = polygraph ended the subscription server-side (admin
-- action). The service gate treats it like canceled/ended (gates only read
-- status='active'), but the payer's Sablier stream may still be running
-- onchain — the web UI uses this value to keep showing the cancel-your-stream
-- affordance so the unstreamed remainder can be reclaimed by the payer.
-- Never set by the lazy reconciler; a stopped row may later flip to
-- 'canceled' / 'ended' when the payer cancels or the stream lapses, never
-- back to 'active'.

alter table ecosystem_payments drop constraint ecosystem_payments_status_check;
alter table ecosystem_payments add constraint ecosystem_payments_status_check
  check (status in ('active', 'canceled', 'ended', 'stopped'));

alter table user_plan_payments drop constraint user_plan_payments_status_check;
alter table user_plan_payments add constraint user_plan_payments_status_check
  check (status in ('active', 'canceled', 'ended', 'stopped'));
