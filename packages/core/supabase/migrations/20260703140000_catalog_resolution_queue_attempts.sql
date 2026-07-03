-- catalog_resolution_queue: also return resolution_attempts.
--
-- The resolver increments resolution_attempts on each write. Returning it from
-- the queue lets the resolver compute attempts+1 without a second round-trip —
-- the previous approach (a batched `id IN (…)` lookup) blew PostgREST's
-- URL-length limit at ~1000 ids (400 Bad Request). Changing a function's return
-- columns requires a drop + recreate.

drop function if exists catalog_resolution_queue(integer, integer);

create function catalog_resolution_queue(batch_limit integer, stale_days integer default 14)
returns table (
  id uuid,
  repository_url text,
  namespace text,
  slug text,
  resolution_attempts integer
)
language sql
stable
as $$
  select s.id, s.repository_url, l.namespace, l.slug, s.resolution_attempts
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
