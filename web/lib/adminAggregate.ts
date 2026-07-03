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

export interface LookupRow {
  server_ref: string;
  hit_count: number;
  miss_count: number;
}

export interface LookupServerTotal {
  server_ref: string;
  total: number;
  hits: number;
  misses: number;
}

export interface LookupSummary {
  totalLookups: number;
  hits: number;
  misses: number;
  /** hits / total; null when there have been no lookups. */
  hitRate: number | null;
  distinctServers: number;
  topServers: LookupServerTotal[];
}

/**
 * Roll per-server lookup counters into headline totals plus the busiest
 * servers. A "hit" is a lookup that found a published grade; a "miss" is one
 * that didn't. `topN` bounds the ranked list.
 */
export function summarizeLookups(
  rows: ReadonlyArray<LookupRow>,
  topN = 10,
): LookupSummary {
  let hits = 0;
  let misses = 0;
  for (const r of rows) {
    hits += r.hit_count;
    misses += r.miss_count;
  }
  const totalLookups = hits + misses;
  const topServers = rows
    .map((r) => ({
      server_ref: r.server_ref,
      total: r.hit_count + r.miss_count,
      hits: r.hit_count,
      misses: r.miss_count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
  return {
    totalLookups,
    hits,
    misses,
    hitRate: totalLookups > 0 ? hits / totalLookups : null,
    distinctServers: rows.length,
    topServers,
  };
}

export interface AgentActivityRow {
  day: string; // YYYY-MM-DD
  agent_name: string;
  endpoint: string;
  hit_count: number;
  miss_count: number;
  call_count: number;
}

export interface AgentActivitySummary {
  /** Calls per day over the window, zero-filled, ascending. */
  perDay: DayBucket[];
  /** Total calls per agent name, descending. */
  byAgent: Bucket[];
  /** Total calls per endpoint, descending. */
  byEndpoint: Bucket[];
}

/**
 * Roll pre-bucketed agent_activity rows (one per day × agent × endpoint) into
 * the admin panel's shapes. Rows outside the `days`-long window ending on
 * `today` (UTC) are ignored.
 */
export function summarizeAgentActivity(
  rows: ReadonlyArray<AgentActivityRow>,
  days: number,
  today: Date,
): AgentActivitySummary {
  const perDay: DayBucket[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = utcDayKey(d);
    dayIndex.set(key, perDay.length);
    perDay.push({ date: key, count: 0 });
  }

  const byAgent = new Map<string, number>();
  const byEndpoint = new Map<string, number>();
  for (const r of rows) {
    const slot = dayIndex.get(r.day);
    if (slot === undefined) continue; // outside the window
    perDay[slot].count += r.call_count;
    byAgent.set(r.agent_name, (byAgent.get(r.agent_name) ?? 0) + r.call_count);
    byEndpoint.set(r.endpoint, (byEndpoint.get(r.endpoint) ?? 0) + r.call_count);
  }

  const toBuckets = (m: Map<string, number>): Bucket[] =>
    Array.from(m, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

  return { perDay, byAgent: toBuckets(byAgent), byEndpoint: toBuckets(byEndpoint) };
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
