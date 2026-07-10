-- ecosystem payments: the POLYGRAPH-stream payment record behind the /manage gate.
--
-- An ecosystem pays for monitoring by creating a 12-month cancelable Sablier
-- Lockup stream of $POLYGRAPH to the polygraph treasury on Base. The web verify
-- route reads the stream onchain (getStream) and, when it checks out, inserts one
-- row here; the /manage console and the weekly digest treat an ecosystem as paid
-- while it has a row with status='active' and end_at in the future. Status is
-- re-checked onchain (statusOf) lazily on access and flipped to 'canceled' /
-- 'ended' when the payer cancels or the stream lapses.
--
-- Pricing is USD-pegged at quote time: ecosystems.monthly_price_usd overrides the
-- app default (null = default, 0 = comped/exempt — no payment required).
--
-- Written only by the service-role client (web /api/manage/[slug]/payment routes);
-- RLS is a default-deny backstop.

alter table ecosystems add column if not exists monthly_price_usd numeric;

comment on column ecosystems.monthly_price_usd is
  'Monitoring price override in USD/month. null = app default; 0 = comped (no payment required).';

create table if not exists ecosystem_payments (
  id               uuid primary key default gen_random_uuid(),
  ecosystem_id     uuid not null references ecosystems(id) on delete cascade,

  -- Where the stream lives.
  chain_id         integer not null,
  sablier_contract text not null,     -- SablierLockup address the stream was created on
  stream_id        numeric not null,  -- Lockup streamId (uint256)
  tx_hash          text,              -- create tx, as reported by the client

  -- What was committed, denominated both ways.
  token            text not null,     -- ERC-20 address ($POLYGRAPH)
  token_decimals   integer not null,
  deposit_amount   numeric not null,  -- raw token units (uint128)
  usd_monthly      numeric not null,  -- price charged, USD/month
  usd_total        numeric not null,  -- usd_monthly × term
  token_usd_rate   numeric not null,  -- token price used at verification time

  payer_address    text not null,     -- stream sender (any wallet; not tied to a member)
  start_at         timestamptz not null,
  end_at           timestamptz not null,

  -- 'active' until an onchain re-check observes cancellation or the end date
  -- passes. One active row per ecosystem is the normal state; history is kept.
  status           text not null default 'active'
                   check (status in ('active', 'canceled', 'ended')),

  verified_at      timestamptz not null default now(),
  last_checked_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  unique (chain_id, sablier_contract, stream_id)
);

create index if not exists ecosystem_payments_ecosystem_status_idx
  on ecosystem_payments (ecosystem_id, status);

alter table ecosystem_payments enable row level security;
grant all on table public.ecosystem_payments to service_role, postgres;
