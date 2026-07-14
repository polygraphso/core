-- Priority grading: the paid 48h lane on the grade_requests queue.
--
-- The original grade_requests migration (20260615130000) reserved this exact
-- shape: "the later burn-to-skip feature adds priority to THIS table — it does
-- not introduce a second queue." A requester pays a one-time $POLYGRAPH
-- transfer to the treasury; the web verify route attributes it by EXACT amount
-- (each quote's raw amount carries unique low-order dust digits, so two open
-- quotes can never collide) and stamps priority_paid_at + a 48h deadline. The
-- fee buys a place in line, never the grade — fulfillment stays the normal
-- manual drain, priority rows first.

alter table grade_requests
  add column if not exists priority_paid_at timestamptz,
  add column if not exists priority_deadline_at timestamptz;

comment on column grade_requests.priority_paid_at is
  'When the paid 48h lane was purchased for this request. Buys turnaround, never the grade.';
comment on column grade_requests.priority_deadline_at is
  'SLA deadline (priority_paid_at + 48h); the admin queue orders open priority rows by this.';

-- The admin priority lane: open paid requests by deadline.
create index if not exists grade_requests_priority_lane_idx
  on grade_requests (priority_deadline_at)
  where priority_paid_at is not null and status in ('queued', 'in_progress');

-- One-time-payment quotes + receipts for the priority lane. A row starts as a
-- 'pending' quote (expected_amount = price in raw token units with randomized
-- atto-scale dust); the verify route flips it to 'paid' when a Transfer log of
-- exactly that amount to the treasury shows up in the submitted tx. Amount
-- uniqueness among open quotes is what makes attribution safe; the tx_hash
-- unique stops one transfer from paying two requests.
--
-- Written only by the service-role client; RLS is a default-deny backstop.
create table if not exists grade_request_payments (
  id               uuid primary key default gen_random_uuid(),
  grade_request_id uuid not null references grade_requests(id) on delete cascade,

  chain_id         integer not null,
  token            text not null,     -- ERC-20 address ($POLYGRAPH)
  token_decimals   integer not null,
  treasury         text not null,     -- transfer recipient the quote was built for

  expected_amount  numeric not null,  -- raw token units incl. unique dust digits
  usd_price        numeric not null,  -- USD charged
  token_usd_rate   numeric not null,  -- token price used at quote time

  status           text not null default 'pending'
                   check (status in ('pending', 'paid', 'expired')),
  tx_hash          text,              -- the paying transfer, once verified
  payer_address    text,              -- Transfer log's from

  expires_at       timestamptz not null,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- Attribution safety: the exact amount is the key, so it must be unique among
-- quotes that can still be paid.
create unique index if not exists grade_request_payments_open_amount_unique
  on grade_request_payments (expected_amount) where status = 'pending';

-- One transfer pays one request.
create unique index if not exists grade_request_payments_tx_unique
  on grade_request_payments (tx_hash) where tx_hash is not null;

create index if not exists grade_request_payments_request_idx
  on grade_request_payments (grade_request_id, status);

alter table grade_request_payments enable row level security;
grant all on table public.grade_request_payments to service_role, postgres;
