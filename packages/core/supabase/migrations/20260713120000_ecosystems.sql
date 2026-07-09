-- ecosystems: the DB-backed home for the ecosystem indices (/base, /bankr,
-- /uniswap, …) and their new self-service management surface.
--
-- Until now each index was a hardcoded TS array (web/lib/baseIndex.ts, etc.), so
-- membership and curation could only change through a deploy. These three tables
-- move that into the DB:
--   ecosystems         — one row per index (slug, copy, page config, visibility)
--   ecosystem_members  — the people who manage an ecosystem (roles + email invites)
--   ecosystem_entries  — the MCP servers / skills an ecosystem tracks
-- Grades are NOT stored here; they are joined live from hosted_runs at read time
-- exactly as the array-backed loaders already do (latestForTarget / loadSkillCohort).
--
-- Global app admins (profiles.is_admin) are superusers over every ecosystem; the
-- per-ecosystem role check lives in the route layer (web/lib/ecosystemAccess.ts).
-- All web access is via the service-role client, so RLS is enabled purely as a
-- default-deny backstop (service_role bypasses it, as with profiles/monitors).

create extension if not exists "citext";

-- ----------------------------------------------------------------------------
-- ecosystems
-- ----------------------------------------------------------------------------
create table if not exists ecosystems (
  id          uuid primary key default gen_random_uuid(),

  -- URL slug: the public page is /ecosystems/<slug>, and the six legacy indices
  -- keep their top-level slug (base, bankr, uniswap, clawhub, skills-sh, virtuals).
  slug        text not null unique,
  name        text not null,
  blurb       text,

  -- Editorial + presentation for the generic renderer, mirroring the code-side
  -- SkillEcosystemConfig: { cohortOrder, cohortLabel, methodologyLabel, cta,
  -- footer, methodologyNote }. Legacy pages seed their existing copy here.
  page_config jsonb not null default '{}'::jsonb,

  is_public   boolean not null default true,   -- public page is reachable
  is_listed   boolean not null default true,   -- appears on the /ecosystems hub
  noindex     boolean not null default true,   -- robots noindex (legacy default)

  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint ecosystems_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  constraint ecosystems_name_len check (char_length(name) between 1 and 200)
);

alter table ecosystems enable row level security;
grant all on table public.ecosystems to service_role, postgres;

-- ----------------------------------------------------------------------------
-- ecosystem_members: users who manage an ecosystem, plus pending email invites.
--
-- An admin invites by email; the row is created with user_id null / status
-- 'invited' and resolves to the account on first sign-in (see
-- resolve_ecosystem_invites below). role 'admin' can manage members + settings;
-- 'member' can add/curate entries.
-- ----------------------------------------------------------------------------
create table if not exists ecosystem_members (
  id            uuid primary key default gen_random_uuid(),
  ecosystem_id  uuid not null references ecosystems(id) on delete cascade,

  email         citext not null,
  user_id       uuid references auth.users(id) on delete cascade,

  role          text not null default 'member' check (role in ('admin', 'member')),
  status        text not null default 'invited' check (status in ('invited', 'active')),

  invited_by    uuid references auth.users(id) on delete set null,
  invited_at    timestamptz not null default now(),
  joined_at     timestamptz,

  -- One membership per (ecosystem, email); re-inviting is a no-op / role update.
  unique (ecosystem_id, email),

  constraint ecosystem_members_email_format check (
    char_length(email::text) between 3 and 254
    and email::text ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  )
);

-- List "the ecosystems this account manages" (dashboard) and resolve invites by
-- email on sign-in.
create index if not exists ecosystem_members_user_idx
  on ecosystem_members (user_id) where user_id is not null;
create index if not exists ecosystem_members_email_idx
  on ecosystem_members (email);

alter table ecosystem_members enable row level security;
grant all on table public.ecosystem_members to service_role, postgres;

-- ----------------------------------------------------------------------------
-- ecosystem_entries: the tracked MCP servers / skills.
--
-- `target` is the canonical hosted_runs ref the grade join keys on; it is
-- nullable because a legacy index can track a project that ships no gradeable MCP
-- (Base lists SDK/CLI-only projects). All the per-index display fields
-- (project, handle, category, party, ownMcp, mcpRef, pending, note, name,
-- section) live in `metadata` so one table carries every index's shape.
-- ----------------------------------------------------------------------------
create table if not exists ecosystem_entries (
  id                 uuid primary key default gen_random_uuid(),
  ecosystem_id       uuid not null references ecosystems(id) on delete cascade,

  target             text,
  target_kind        text not null
                     check (target_kind in ('registry_ref', 'remote_url', 'skill')),

  cohort             text,
  visible            boolean not null default true,   -- shown on the public page
  featured           boolean not null default false,  -- surfaced with a ★
  position           integer not null default 0,      -- manual ordering within a cohort

  metadata           jsonb not null default '{}'::jsonb,

  -- In-flight immediate-grade job (the runner's job id + last seen status), so the
  -- dashboard can poll a freshly added entry until its grade lands in hosted_runs.
  last_grade_run_id  text,
  last_grade_status  text,

  added_by           uuid references auth.users(id) on delete set null,
  added_at           timestamptz not null default now(),

  constraint ecosystem_entries_target_len check (target is null or char_length(target) between 1 and 512)
);

-- One entry per (ecosystem, target); a null target (tracked-only row) is exempt.
create unique index if not exists ecosystem_entries_target_unique
  on ecosystem_entries (ecosystem_id, target) where target is not null;
create index if not exists ecosystem_entries_ecosystem_idx
  on ecosystem_entries (ecosystem_id);

alter table ecosystem_entries enable row level security;
grant all on table public.ecosystem_entries to service_role, postgres;

-- ----------------------------------------------------------------------------
-- Invite resolution: bind pending (user_id null) invites for an email to the
-- account, marking them active. Called from the auth.users insert trigger AND
-- lazily via RPC from the access helper (covers someone invited after they had
-- already signed up, whom the trigger never fires for).
-- ----------------------------------------------------------------------------
create or replace function resolve_ecosystem_invites(p_user uuid, p_email text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if p_user is null or p_email is null or char_length(p_email) = 0 then
    return;
  end if;
  update ecosystem_members
     set user_id   = p_user,
         status    = 'active',
         joined_at = coalesce(joined_at, now())
   where email = p_email::citext
     and user_id is null;
end;
$$;

revoke all on function resolve_ecosystem_invites(uuid, text) from public;
grant execute on function resolve_ecosystem_invites(uuid, text) to service_role, postgres;

-- Claim invites automatically on signup. Separate trigger from handle_new_user
-- (20260703120000_profiles) so each stays single-purpose; both fire on insert.
create or replace function claim_ecosystem_invites_on_signup()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform resolve_ecosystem_invites(new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created_claim_invites
  after insert on auth.users
  for each row execute procedure claim_ecosystem_invites_on_signup();
