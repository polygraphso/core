/**
 * Pure aggregation helpers for the admin dashboard. No I/O, no imports — the
 * Supabase fetchers in adminMetrics.ts call these so all the date/grouping
 * logic is unit-tested in isolation. All day bucketing is UTC to avoid
 * timezone-dependent flakiness.
 */

export interface DayBucket {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface Bucket {
  key: string;
  count: number;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Group ISO timestamps into the last `days` UTC days ending on `today`
 * (inclusive). Always returns exactly `days` ascending buckets, zero-filled.
 * Null / unparseable / out-of-window timestamps are ignored.
 */
export function bucketByDay(
  timestamps: ReadonlyArray<string | null | undefined>,
  days: number,
  today: Date,
): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, number>();
  // Build the zero-filled window, oldest first.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = utcDayKey(d);
    index.set(key, buckets.length);
    buckets.push({ date: key, count: 0 });
  }
  for (const ts of timestamps) {
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const slot = index.get(utcDayKey(d));
    if (slot !== undefined) buckets[slot].count += 1;
  }
  return buckets;
}

/**
 * Count occurrences of each value, sorted descending by count. Null/empty
 * values fold into `nullLabel`. Optional `limit` truncates to the top N.
 */
export function tally(
  values: ReadonlyArray<string | null | undefined>,
  nullLabel = "—",
  limit?: number,
): Bucket[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v && v.length > 0 ? v : nullLabel;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = Array.from(counts, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count,
  );
  return limit ? out.slice(0, limit) : out;
}
