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
  scheduled_at: string | null;
  posted_at: string | null;
  tweets: TwitterThreadTweet[];
  alt_text: string | null;
  image_ref: string | null;
  sources: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
