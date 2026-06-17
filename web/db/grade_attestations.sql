-- Run once in the Supabase SQL editor (and once per environment/project).
-- Records each on-chain EAS attestation attempt for a published grade.
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
  status            text        not null default 'pending',  -- pending | confirmed | failed
  error             text,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

create index if not exists grade_attestations_run_idx
  on grade_attestations (hosted_run_id);
create index if not exists grade_attestations_server_version_idx
  on grade_attestations (server, version);
