-- User profiles: one row per auth user, auto-created on signup.
-- is_admin controls access to the /admin area; set via the admin UI or SQL.
--
-- Bootstrap the first admin (two steps — profiles table + JWT app_metadata):
--   update profiles set is_admin = true where id = '<your-user-uuid>';
--   update auth.users
--     set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
--     where id = '<your-user-uuid>';
-- Subsequent grants/revokes via the Admin › Users UI update both automatically.

create table profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  is_admin  boolean not null default false
);

alter table profiles enable row level security;

-- Users can read their own profile row (needed for client-side isAdmin check).
-- Service role bypasses RLS by default.
create policy "profiles: own read"
  on profiles for select
  using (auth.uid() = id);

-- Auto-create a profile row for every new Supabase Auth signup.
create or replace function handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Back-fill a profile row for every user that already exists.
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;
