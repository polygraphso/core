-- Polygraph foundational tables: servers, versions, adoption_scores, runs.
-- Schema follows core-contracts.md. Other packages add their tables in later
-- migrations: litmus → behavioral_grades, onboarding → users + alerts.

create extension if not exists "pgcrypto";

-- ── servers ──────────────────────────────────────────────────────────────────
-- One row per MCP server (identity hub). A server is {registry, owner, name};
-- its versions live in the versions table.

create table if not exists servers (
  id                  uuid primary key default gen_random_uuid(),
  registry            text not null check (registry in ('npm', 'pypi', 'github')),
  owner               text not null,
  name                text not null,
  first_seen          timestamptz not null default now(),
  last_seen           timestamptz not null default now(),
  latest_version_id   uuid,
  unique (registry, owner, name)
);

-- ── versions ─────────────────────────────────────────────────────────────────
-- Append-only as we detect new registry publications.

create table if not exists versions (
  id            uuid primary key default gen_random_uuid(),
  server_id     uuid not null references servers(id) on delete cascade,
  version       text not null,
  published_at  timestamptz,
  manifest_url  text,
  source_url    text,
  detected_at   timestamptz not null default now(),
  unique (server_id, version)
);

create index if not exists versions_server_id_idx
  on versions (server_id);

create index if not exists versions_detected_at_idx
  on versions (detected_at desc);

alter table servers
  add constraint servers_latest_version_id_fkey
  foreign key (latest_version_id) references versions(id) on delete set null;

-- ── adoption_scores ──────────────────────────────────────────────────────────
-- Per scoring-brief: one row per version_id per scoring run, latest read by
-- consumers. (Diverges from the unique-version_id sketch in core-contracts.md;
-- per-run history is required for debugging "why did this drop a tier?".)

create table if not exists adoption_scores (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references versions(id) on delete cascade,
  score         numeric not null,
  tier          text check (tier in ('top10', 'top25', 'top50', 'top100')),
  components    jsonb not null default '{}'::jsonb,
  computed_at   timestamptz not null default now()
);

create index if not exists adoption_scores_version_latest_idx
  on adoption_scores (version_id, computed_at desc);

create index if not exists adoption_scores_tier_idx
  on adoption_scores (tier) where tier is not null;

create index if not exists adoption_scores_score_idx
  on adoption_scores (score desc);

-- ── runs ─────────────────────────────────────────────────────────────────────
-- Tracks every scoring and litmus run (queued → running → completed/failed).

create table if not exists runs (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references versions(id) on delete cascade,
  kind          text not null check (kind in ('scoring', 'litmus')),
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'completed', 'failed')),
  started_at    timestamptz,
  finished_at   timestamptz,
  log_url       text,
  error         jsonb
);

create index if not exists runs_version_kind_idx
  on runs (version_id, kind);

create index if not exists runs_active_idx
  on runs (status) where status in ('queued', 'running');
