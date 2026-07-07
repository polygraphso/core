-- twitter_threads.image_url: public URL of the thread's showcase image in the
-- `twitter-images` Storage bucket. `image_ref` stays the human filename label;
-- `image_url` is the reachable URL the admin previews / copies / pastes into X.

alter table twitter_threads add column if not exists image_url text;
