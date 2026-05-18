-- Restore the server-side-only Supabase access pattern. All polygraph queries
-- run from Next.js with the service-role key (bypasses RLS). The anon key is
-- not wired up to the browser; every public-schema table fails closed to anon
-- as defense-in-depth.
--
-- The previous migration (20260518130000_enable_rls_foundational_tables.sql)
-- added anon SELECT policies on servers/versions/adoption_scores under the
-- mistaken assumption that the public grades page reads via the anon key.
-- The grades page reads through a Next.js route handler with the service-role
-- key, so the policies are unnecessary and weaken the fail-closed posture.
-- RLS stays enabled on every table.

drop policy if exists servers_anon_read         on servers;
drop policy if exists versions_anon_read        on versions;
drop policy if exists adoption_scores_anon_read on adoption_scores;
