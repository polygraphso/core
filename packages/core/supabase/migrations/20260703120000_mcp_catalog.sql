-- mcp_catalog: a thin, provider-agnostic discovery index of the MCP universe.
--
-- Purpose: know which servers EXIST (to pick what to grade) and which we've
-- already graded — a coverage map, not the scoring substrate. It is deliberately
-- decoupled from `servers`/`server_identities` (the hand-curated, heavily
-- enriched set the adoption pipeline walks): this table holds ~50k rows of
-- identity only, refreshed daily from directory providers.
--
-- Two tiers, mirroring `servers` + `server_identities`:
--   catalog_servers  — one row per real MCP server, deduped ACROSS providers.
--   catalog_listings — one row per (provider, provider id); many listings can
--                      point at the same canonical server (a server that appears
--                      on Glama AND Smithery is one catalog_servers row, two
--                      listings). Glama is just the first provider.
--
-- Written by packages/scoring's catalog-sync script (service-role). No PII, but
-- service-role-only like the rest of the pipeline tables.

-- Canonical MCP server, provider-independent.
create table if not exists catalog_servers (
  id             uuid primary key default gen_random_uuid(),

  -- Cross-provider dedup key: the normalized repository URL when one exists
  -- (e.g. 'github.com/owner/repo'), else '<provider>:<provider_uid>'. Two
  -- listings sharing a repo collapse to one canonical server.
  canonical_key  text not null unique,

  name           text,
  repository_url text,

  -- Coarse "is this worth trying to grade" heuristic (union over its listings):
  -- remote-capable / has a repo. Advisory only — refined by the actual grade run.
  gradeable      boolean,

  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),

  constraint catalog_servers_canonical_key_len check (char_length(canonical_key) between 1 and 512)
);

-- One row per (provider, provider id).
create table if not exists catalog_listings (
  id                  uuid primary key default gen_random_uuid(),
  catalog_server_id   uuid not null references catalog_servers(id) on delete cascade,

  provider            text not null,  -- 'glama' | 'smithery' | 'mcp_registry' | ...
  provider_uid        text not null,  -- glama server id, smithery qualifiedName, ...

  namespace           text,
  slug                text,
  name                text,
  url                 text,           -- provider-facing page URL
  attributes          text[] not null default '{}',

  -- Provider's creation time. Glama exposes this only via the pagination
  -- cursor, not per-server, so for Glama it is page-granular (monotonic across
  -- pages, tied within a page) — good enough for newest-first ordering.
  provider_created_at timestamptz,

  first_synced_at     timestamptz not null default now(),
  last_synced_at      timestamptz not null default now(),

  unique (provider, provider_uid),
  constraint catalog_listings_provider_len check (char_length(provider) between 1 and 64),
  constraint catalog_listings_provider_uid_len check (char_length(provider_uid) between 1 and 256)
);

create index if not exists catalog_listings_server_idx on catalog_listings (catalog_server_id);
create index if not exists catalog_listings_provider_idx on catalog_listings (provider);
create index if not exists catalog_servers_gradeable_idx on catalog_servers (gradeable) where gradeable;
create index if not exists catalog_servers_repo_idx on catalog_servers (repository_url);

alter table catalog_servers enable row level security;
alter table catalog_listings enable row level security;

grant all on table public.catalog_servers to service_role, postgres;
grant all on table public.catalog_listings to service_role, postgres;
