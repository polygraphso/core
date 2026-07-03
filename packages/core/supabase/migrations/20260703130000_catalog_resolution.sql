-- catalog_resolution: turn discovered servers into runnable grading targets.
--
-- The discovery catalog (20260703120000_mcp_catalog) records which MCP servers
-- EXIST, keyed by repository URL. But a bare github repo isn't runnable — the
-- litmus harness grades by launching an npm package (npx), a pypi package
-- (uvx), or connecting to a remote https MCP URL. This migration adds a
-- resolution layer: for each canonical server we try to resolve a concrete
-- `grading_target`, and only servers that resolve are actually gradeable.
--
-- `gradeable` is repurposed to three states:
--   NULL  — not yet attempted
--   true  — resolved to a runnable target (grading_target is set)
--   false — attempted, nothing runnable found (docker-only, local build, dead repo)
-- The prior coarse "has a repo" heuristic set gradeable=true on every row; we
-- reset it to NULL here since none are actually resolved yet.

alter table catalog_servers
  add column if not exists grading_target        text,   -- 'npm/<pkg>' | 'pypi/<pkg>' | 'https://…'
  add column if not exists grading_kind          text,   -- 'npm' | 'pypi' | 'url'
  add column if not exists resolution_status      text,   -- 'resolved' | 'unresolved' | 'error' (NULL = never attempted)
  add column if not exists resolution_checked_at  timestamptz,
  add column if not exists resolution_attempts    integer not null default 0;

alter table catalog_servers
  add constraint catalog_servers_grading_kind_chk
    check (grading_kind is null or grading_kind in ('npm', 'pypi', 'url'));
alter table catalog_servers
  add constraint catalog_servers_resolution_status_chk
    check (resolution_status is null or resolution_status in ('resolved', 'unresolved', 'error'));

-- The old blanket gradeable=true was the coarse discovery heuristic; retire it.
-- Resolution is now the source of truth for `gradeable`.
update catalog_servers set gradeable = null;

-- Priority queue for the resolver: candidates ordered so the servers worth
-- grading resolve first.
create index if not exists catalog_servers_resolution_idx
  on catalog_servers (resolution_status, resolution_checked_at);

-- Exact-match coverage: which resolved servers we've already graded.
create index if not exists catalog_servers_grading_target_idx
  on catalog_servers (grading_target)
  where grading_target is not null;

-- The batch a resolver run should attempt next, in priority order:
--   1. never-attempted (resolution_status IS NULL)
--   2. previously errored (transient — retry next run)
--   3. previously unresolved but past the cooldown (a repo may publish later)
-- Within each tier: attribute-flagged (remote-capable / hybrid / official) and
-- newest first. Returns one representative glama listing's namespace/slug so the
-- resolver can hit the provider page for the fallback tier.
create or replace function catalog_resolution_queue(batch_limit integer, stale_days integer default 14)
returns table (id uuid, repository_url text, namespace text, slug text)
language sql
stable
as $$
  select s.id, s.repository_url, l.namespace, l.slug
  from catalog_servers s
  join lateral (
    select cl.namespace, cl.slug, cl.attributes, cl.provider_created_at
    from catalog_listings cl
    where cl.catalog_server_id = s.id
    order by (cl.provider = 'glama') desc, cl.provider_created_at desc nulls last
    limit 1
  ) l on true
  where s.resolution_status is null
     or s.resolution_status = 'error'
     or (s.resolution_status = 'unresolved'
         and (s.resolution_checked_at is null
              or s.resolution_checked_at < now() - make_interval(days => stale_days)))
  order by
    (s.resolution_status is null) desc,
    (s.resolution_status = 'error') desc,
    (l.attributes && array['hosting:remote-capable', 'hosting:hybrid', 'author:official']) desc,
    l.provider_created_at desc nulls last
  limit batch_limit;
$$;

grant execute on function catalog_resolution_queue(integer, integer) to service_role, postgres;
