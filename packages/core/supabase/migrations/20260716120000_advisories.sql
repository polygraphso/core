-- advisories + advisory_targets: the persisted CVE store for ecosystem monitoring.
--
-- The daily scoring run already reads deps.dev advisory *severities* into
-- adoption_scores.components, but it discards the advisory identities. To show an
-- ecosystem admin an actual "CVEs to fix" list (and to email a weekly digest), we
-- persist the real advisory detail here:
--   advisories        — one row per GHSA (the natural key deps.dev / OSV / GitHub
--                       all speak), carrying CVE aliases, severity, summary, link.
--   advisory_targets  — the many-to-one mapping of an advisory to the versionless
--                       package key an ecosystem_entries.target keys on, so the
--                       read-time join is plain equality.
--
-- Populated daily by packages/scoring (ingest-advisories.ts, .github/workflows/
-- advisories.yml) from deps.dev + OSV (npm/pypi) and GitHub Security Advisories
-- (github targets). All web/engine access is via the service-role client, so RLS
-- is a default-deny backstop only (service_role bypasses it, as with monitors).

-- ----------------------------------------------------------------------------
-- advisories: one row per GHSA. Keyed by ghsa_id (not package+version) so the
-- same CVE affecting many packages is stored once, and re-ingesting is an upsert.
-- ----------------------------------------------------------------------------
create table if not exists advisories (
  id            uuid primary key default gen_random_uuid(),

  -- GitHub advisory id (GHSA-xxxx-…): the stable identity every source shares.
  ghsa_id       text not null unique,

  -- Provenance of the richest fetch that last wrote this row.
  source        text not null check (source in ('depsdev', 'github', 'osv')),

  -- CVE aliases (e.g. {CVE-2024-1234}); a GHSA may map to zero or more CVEs.
  cve_ids       text[] not null default '{}',

  severity      text check (severity in ('CRITICAL', 'HIGH', 'MODERATE', 'LOW')),
  cvss          numeric,
  cvss_vector   text,
  summary       text,
  url           text,

  published_at  timestamptz,
  withdrawn_at  timestamptz,   -- rescinded advisories are suppressed at read time

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

alter table advisories enable row level security;
grant all on table public.advisories to service_role, postgres;

-- ----------------------------------------------------------------------------
-- advisory_targets: which package(-version) an advisory affects. `package_key`
-- is the exact versionless target form ecosystem_entries store
-- (npm/@scope/pkg | pypi/pkg | github/owner/repo), so the CVE tab / digest join
-- is a plain equality. We store the affected `range` + `fixed_version` + an
-- `is_current_affected` snapshot rather than one row per version per run.
-- ----------------------------------------------------------------------------
create table if not exists advisory_targets (
  id                  uuid primary key default gen_random_uuid(),
  advisory_id         uuid not null references advisories(id) on delete cascade,

  package_key         text not null,
  ecosystem           text not null check (ecosystem in ('npm', 'pypi', 'github')),

  affected_range      text,   -- OSV range string, e.g. ">=1.0.0 <1.4.2"
  fixed_version       text,
  current_version     text,   -- the version we evaluated affected-ness against

  -- Did the current version fall in the affected range — drives the "to fix"
  -- filter on the CVE tab and the digest. markTargetsStale flips this to false
  -- when an advisory no longer applies (e.g. the package was patched).
  is_current_affected boolean not null default true,

  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),

  unique (advisory_id, package_key)
);

-- Read join (CVE tab / digest look up by package_key) + a partial index for the
-- common "only currently-affected" query.
create index if not exists advisory_targets_package_idx
  on advisory_targets (package_key);
create index if not exists advisory_targets_affected_idx
  on advisory_targets (package_key) where is_current_affected;

alter table advisory_targets enable row level security;
grant all on table public.advisory_targets to service_role, postgres;

-- ----------------------------------------------------------------------------
-- upsert_advisory: idempotent upsert by ghsa_id, returning the advisory id so
-- the ingest store does one round-trip per advisory before writing its targets.
-- ----------------------------------------------------------------------------
create or replace function upsert_advisory(
  p_ghsa_id      text,
  p_source       text,
  p_cve_ids      text[],
  p_severity     text,
  p_cvss         numeric,
  p_cvss_vector  text,
  p_summary      text,
  p_url          text,
  p_published_at timestamptz,
  p_withdrawn_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into advisories (
    ghsa_id, source, cve_ids, severity, cvss, cvss_vector, summary, url,
    published_at, withdrawn_at
  ) values (
    p_ghsa_id, p_source, coalesce(p_cve_ids, '{}'), p_severity, p_cvss,
    p_cvss_vector, p_summary, p_url, p_published_at, p_withdrawn_at
  )
  on conflict (ghsa_id) do update
    set source       = excluded.source,
        cve_ids      = excluded.cve_ids,
        severity     = excluded.severity,
        cvss         = excluded.cvss,
        cvss_vector  = excluded.cvss_vector,
        summary      = excluded.summary,
        url          = excluded.url,
        published_at = excluded.published_at,
        withdrawn_at = excluded.withdrawn_at,
        last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function upsert_advisory(text, text, text[], text, numeric, text, text, text, timestamptz, timestamptz) from public;
grant execute on function upsert_advisory(text, text, text[], text, numeric, text, text, text, timestamptz, timestamptz) to service_role, postgres;
