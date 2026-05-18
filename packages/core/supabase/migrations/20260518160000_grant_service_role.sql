-- Grant DML on foundational tables to the service-role (and postgres),
-- plus a default-privileges change so future tables auto-grant.
--
-- Why: Supabase auto-grants only on tables created through Studio. Tables
-- created via SQL migrations need explicit GRANTs, otherwise the PostgREST
-- service_role gets `42501 permission denied for table` even though it
-- bypasses RLS. Caught when the scoring seed script first tried to upsert.
--
-- anon and authenticated remain unprivileged on these tables, preserving
-- the server-side-only access pattern documented in
-- project_supabase_access memory.

grant all on table
  public.servers,
  public.versions,
  public.adoption_scores,
  public.runs
to service_role, postgres;

-- Forward fix: any table created in `public` going forward auto-grants to
-- service_role + postgres. Saves litmus (behavioral_grades) and onboarding
-- (users, alerts) from rediscovering this.

alter default privileges in schema public
  grant all on tables to service_role, postgres;
