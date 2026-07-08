-- twitter_threads.account: which X account a thread is posted from.
-- 'product' = @polygraphso (the record: grades, index deltas, releases,
-- methodology); 'personal' = the founder account (voice: commentary, QTs).
-- Existing rows backfill to 'personal' (they were posted from the personal
-- account); the default then flips to 'product' so new threads land on the
-- record account unless retagged in the editor.

alter table twitter_threads
  add column if not exists account text not null default 'personal'
  check (account in ('personal', 'product'));

alter table twitter_threads alter column account set default 'product';
