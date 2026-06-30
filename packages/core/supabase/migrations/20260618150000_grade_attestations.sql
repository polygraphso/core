-- grade_attestations: on-chain EAS attestation records for published grades.
--
-- Each row is one attempt to publish a grade as a tamper-proof attestation on
-- Base via the Ethereum Attestation Service (EAS). The admin route
-- (web/app/api/admin/attestations/route.ts) is the sole writer: it inserts a
-- 'pending' row before submitting the transaction, then marks it 'confirmed'
-- (with the attestation UID + tx hash) or 'failed'. The public evidence page
-- and the admin list read it back. History is kept — a failed attempt does not
-- block a retry — so this table is append-mostly.
--
-- hosted_run_id is stored as text (not a FK) so it matches regardless of the
-- hosted_runs id type; we only ever look it up by equality. Service-role only:
-- written and read exclusively server-side (no anon policy → RLS denies anon).

create table if not exists grade_attestations (
  id                bigint generated always as identity primary key,
  hosted_run_id     text        not null,
  server            text        not null,
  version           text        not null default '',
  grade             text        not null,
  schema_uid        text        not null,
  attestation_uid   text,
  tx_hash           text,
  chain_id          integer     not null,
  attester_address  text,
  evidence_hash     text        not null,
  status            text        not null default 'pending'
                    check (status in ('pending', 'confirmed', 'failed')),
  error             text,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

-- Idempotency guard: confirmed attestation lookup for a given run.
create index if not exists grade_attestations_run_idx
  on grade_attestations (hosted_run_id);

-- Public evidence page: latest confirmed attestation for a (server, version).
create index if not exists grade_attestations_server_version_idx
  on grade_attestations (server, version);

alter table grade_attestations enable row level security;

grant all on table public.grade_attestations to service_role, postgres;
