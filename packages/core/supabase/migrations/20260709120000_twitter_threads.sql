-- twitter_threads: the launch/announcement threads authored for @polygraphso,
-- editable from Admin › Twitter.
--
-- The threads were authored as files in the workspace twitter/<ts>_<slug>/ dir
-- (thread.txt + sources.md + showcase.png). The admin dashboard runs on Vercel
-- (read-only filesystem, can't reach those files), so to view/edit them in the
-- browser they live here instead. Seeded once from the files
-- (web/scripts/seed-twitter-threads.mjs); the DB is the home going forward — the
-- files are not kept in sync.
--
-- tweets is an ordered jsonb array ([{ "text": "..." }, ...]); a thread is always
-- read and saved as a whole, so the tweets don't need their own table. Char
-- counts are computed in the UI (X-weighted), not stored.
--
-- Admin-only: RLS on with no anon/auth policy; only the service-role API routes
-- (web/app/api/admin/twitter/*) read and write it.

create table if not exists twitter_threads (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  status        text not null default 'draft'
                check (status in ('draft', 'scheduled', 'posted')),
  scheduled_at  timestamptz,
  posted_at     timestamptz,
  -- [{ "text": "..." }, ...] in thread order.
  tweets        jsonb not null default '[]'::jsonb,
  alt_text      text,
  image_ref     text,
  sources       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint twitter_threads_title_len check (char_length(title) between 1 and 300),
  constraint twitter_threads_slug_len  check (char_length(slug)  between 1 and 200)
);

create index if not exists twitter_threads_scheduled_idx on twitter_threads (scheduled_at desc);
create index if not exists twitter_threads_updated_idx on twitter_threads (updated_at desc);

alter table twitter_threads enable row level security;

grant all on table public.twitter_threads to service_role, postgres;
