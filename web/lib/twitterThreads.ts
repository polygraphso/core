/**
 * Row types for the `twitter_threads` table (Admin › Twitter).
 *
 * web/ is a standalone deploy target — it mirrors the shared row types locally
 * rather than importing `@polygraph/core`. The schema's source of truth is
 * packages/core (migration + src/types.ts:TwitterThreadRow); keep this in sync
 * with it.
 */

export type TwitterThreadStatus = "draft" | "scheduled" | "posted";

/**
 * Which X account a thread is posted from. 'product' = @polygraphso (the
 * record: grades, index deltas, releases, methodology); 'personal' = the
 * founder account (voice: commentary, quote-tweets).
 */
export type TwitterAccount = "personal" | "product";

/**
 * One tweet in a thread, in order. Char counts are computed in the UI.
 * `url` is the X permalink once the tweet is live; `posted` marks it live.
 */
export interface TwitterThreadTweet {
  text: string;
  url?: string | null;
  posted?: boolean;
}

export interface TwitterThreadRow {
  id: string;
  slug: string;
  title: string;
  status: TwitterThreadStatus;
  account: TwitterAccount;
  scheduled_at: string | null;
  posted_at: string | null;
  tweets: TwitterThreadTweet[];
  /** Permalink of the thread's main (root) tweet — the whole-thread share link. */
  main_url: string | null;
  alt_text: string | null;
  /** Human filename label for the showcase image (e.g. "showcase.png"). */
  image_ref: string | null;
  /** Public URL of the showcase image in the `twitter-images` Storage bucket. */
  image_url: string | null;
  sources: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
