-- hosted_runs: the paid hosted litmus service (polygraph.so/run).
--
-- This table IS the web ↔ infra contract (hosted-service-brief.md):
--   web (Next.js routes)  → inserts rows, verifies payment, flips to 'queued'
--   infra worker (Ruben)  → claims 'queued' rows, runs litmus-v1, writes
--                           results, flips to 'complete' / 'failed'
--
-- Worker claim pattern (atomic, safe for multiple workers):
--   update hosted_runs set status='running', run_started_at=now()
--   where id = (select id from hosted_runs where status='queued'
--               order by paid_at limit 1 for update skip locked)
--   returning *;
--
-- Independence rule baked into the product: payment buys the RUN, never
-- the grade. Results publish pass or fail; payment_tx is disclosed on the
-- report. There is no column for "requester approval" on purpose.
--
-- PII (email / user_id / payer address), so service-role only; the
-- Next.js routes and the infra worker are the only writers.

create extension if not exists "citext";

create table if not exists hosted_runs (
  id            uuid primary key default gen_random_uuid(),

  -- What to test. registry_ref = npm/… | pypi/… | github/… (full sandbox,
  -- A possible). remote_url = https:// MCP endpoint (egress unverifiable,
  -- grade ceiling B by design — shown to the requester before payment).
  target        text not null,
  target_kind   text not null check (target_kind in ('registry_ref', 'remote_url')),

  -- Requester. Anonymous → email; signed-in → user_id (email optional copy).
  email         citext,
  user_id       uuid references auth.users(id) on delete set null,

  status        text not null default 'created'
                check (status in ('created', 'paid', 'queued', 'running',
                                  'complete', 'failed')),

  -- Payment (USDC on Base). price in 6-decimal token units.
  -- payment_tx unique = the replay guard: one tx hash pays for one run.
  price_usdc    bigint,
  payment_tx    text unique,
  payer_address text,
  paid_at       timestamptz,

  -- Results — written only by the infra worker. Shapes mirror the litmus
  -- evidence bundle (litmus repo docs/onchain-proof-spec.md).
  grade                  text check (grade in ('A', 'B', 'D', 'F')),
  c01                    text check (c01 in ('pass', 'fail', 'skipped', 'partial')),
  c02                    text check (c02 in ('pass', 'fail', 'skipped', 'partial')),
  c03                    text check (c03 in ('pass', 'fail', 'skipped', 'partial')),
  tool_defs_fingerprint  text,
  methodology_version    text,
  rationale              text,
  evidence               jsonb,
  evidence_url           text,
  failure_reason         text,

  ran_at          timestamptz,
  run_started_at  timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- Publication into the public lookup is a separate, reviewed step
  -- (vendor-first disclosure for third-party-requested failures).
  published_at  timestamptz,

  constraint hosted_runs_target_len check (char_length(target) between 1 and 512),

  constraint hosted_runs_email_format check (
    email is null
    or (
      char_length(email::text) between 3 and 254
      and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
    )
  ),

  -- A run needs someone to report back to.
  constraint hosted_runs_requester check (email is not null or user_id is not null),

  -- A completed run must carry a grade; a failed one must say why.
  constraint hosted_runs_complete_has_grade check (
    status <> 'complete' or grade is not null
  ),
  constraint hosted_runs_failed_has_reason check (
    status <> 'failed' or failure_reason is not null
  )
);

-- Worker queue scan + dashboard listings.
create index if not exists hosted_runs_queued_idx
  on hosted_runs (paid_at) where status = 'queued';

create index if not exists hosted_runs_user_idx
  on hosted_runs (user_id, created_at desc) where user_id is not null;

create index if not exists hosted_runs_status_idx
  on hosted_runs (status);

alter table hosted_runs enable row level security;

grant all on table public.hosted_runs to service_role, postgres;
