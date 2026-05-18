-- Enable RLS on foundational tables and grant public read where appropriate.
-- The Supabase project forces RLS on the public schema, so tables without
-- policies return zero rows through the anon key. servers/versions/
-- adoption_scores back the public grades page; runs is internal infra and
-- gets no anon policy (service-role bypasses RLS).

alter table servers          enable row level security;
alter table versions         enable row level security;
alter table adoption_scores  enable row level security;
alter table runs             enable row level security;

create policy servers_anon_read
  on servers for select to anon using (true);

create policy versions_anon_read
  on versions for select to anon using (true);

create policy adoption_scores_anon_read
  on adoption_scores for select to anon using (true);

-- runs intentionally has no anon policy.

-- ── FK index on servers.latest_version_id ────────────────────────────────────
-- Frequent read pattern: list servers joined to their latest version.

create index if not exists servers_latest_version_id_idx
  on servers (latest_version_id) where latest_version_id is not null;
