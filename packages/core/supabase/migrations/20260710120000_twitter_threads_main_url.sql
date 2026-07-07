-- twitter_threads.main_url: the permalink of the thread's main (root) tweet —
-- the single canonical URL you'd share for the whole thread. Distinct from the
-- per-tweet `url` fields inside the `tweets` jsonb array.

alter table twitter_threads add column if not exists main_url text;
