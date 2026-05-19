-- Cross-registry identity stitching. One row per (server, source) pair —
-- e.g., the same logical server has a Smithery `qualifiedName`, a Glama
-- `namespace/slug`, and (later) an Official MCP Registry id.
--
-- Populated initially by hand-curation in the seed YAML for ~10-15
-- well-known servers. Phase 2 (next PR) wires an Official-MCP-Registry
-- adapter that joins on the npm/pypi identifier from registry.packages[]
-- and auto-populates rows for the registry-listed subset. No fuzzy
-- matching — silent false positives are unacceptable for trust-grading
-- data (per scoring-brief.md "Cross-registry identity stitching").

create table if not exists server_identities (
  id          uuid primary key default gen_random_uuid(),
  server_id   uuid not null references servers(id) on delete cascade,
  source      text not null,        -- 'npm' | 'pypi' | 'github' | 'smithery' | 'glama' | 'mcp_registry'
                                    -- intentionally text + check, not enum, so new sources don't need migrations
  identity    text not null,        -- registry-native identifier
  source_url  text,                 -- canonical link on that registry (nullable)
  added_at    timestamptz not null default now(),
  constraint server_identities_source_check
    check (source in ('npm', 'pypi', 'github', 'smithery', 'glama', 'mcp_registry')),
  unique (server_id, source)        -- one identity per source per server
);

-- Reverse lookups: "which server is this Smithery entry?"
create index if not exists server_identities_source_identity_idx
  on server_identities (source, identity);

-- Standard grants, matching the other foundational tables. service_role
-- bypasses RLS; anon stays unprivileged per the server-side-only access
-- pattern (see project_supabase_access memory). The ALTER DEFAULT
-- PRIVILEGES from migration 160000 covers new tables automatically, but
-- we list them explicitly for clarity.

alter table server_identities enable row level security;

grant all on table server_identities to service_role, postgres;
