/**
 * Pure aggregation helpers for the admin revenue dashboard. No I/O, no Supabase —
 * the fetchers in revenueMetrics.ts normalize the three payment tables into
 * RevenueEntry[] and call these, so all the summing/bucketing logic is unit-tested
 * in isolation. Mirrors adminAggregate.ts (UTC day keys, zero-filled windows).
 *
 * The two stream surfaces (ecosystem + Pro plans) are PREPAID Sablier deposits, so
 * a "buy" books the full `usd_total` as cash-in on its verification date; priority
 * grading is a one-time transfer booking `usd_price`. MRR is a separate lens on the
 * recurring `monthly` value of streams that are still active.
 */

import type { DayBucket, Bucket } from "@/lib/adminAggregate";

export type RevenueSurface = "ecosystem" | "indie" | "team" | "priority";

/** One normalized purchase across all paid surfaces. */
export interface RevenueEntry {
  surface: RevenueSurface;
  /** The specific thing bought: ecosystem slug or priority target; "" for plans (surface names it). */
  label: string;
  /** Booked cash for this buy — full prepaid deposit (streams) or one-time price (priority). */
  usd: number;
  /** Recurring monthly value for streams; null for one-time priority buys. */
  monthly: number | null;
  /** verified_at (streams) / paid_at (priority), ISO. */
  at: string;
  /** Stream end date, ISO; null for one-time buys. */
  endAt: string | null;
  /** Paying wallet (streams: sender; priority: transfer from). */
  payer: string | null;
  /** Auth user this buy is attributable to (plan: user_id; priority: resolved from email). Null for ecosystem/wallet-only buys. */
  userId: string | null;
  /** Email of the attributable user, for display. */
  userEmail: string | null;
  /** 'active' | 'canceled' | 'ended' (streams) | 'paid' (priority). */
  status: string;
  recurring: boolean;
}

/** Display names for the four revenue lines. */
export const SURFACE_LABEL: Record<RevenueSurface, string> = {
  ecosystem: "Ecosystem",
  indie: "Pro · Indie",
  team: "Pro · Team",
  priority: "Priority grade",
};

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Sum booked USD into the last `days` UTC days ending on `today` (inclusive).
 * Always returns exactly `days` ascending buckets, zero-filled; the summed dollars
 * live in `count` so MiniBars/BarList render them unchanged. Null / unparseable /
 * out-of-window entries are ignored. Daily totals are rounded to whole dollars.
 */
export function sumByDay(
  entries: ReadonlyArray<RevenueEntry>,
  days: number,
  today: Date,
): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = utcDayKey(d);
    index.set(key, buckets.length);
    buckets.push({ date: key, count: 0 });
  }
  for (const e of entries) {
    if (!e.at) continue;
    const d = new Date(e.at);
    if (Number.isNaN(d.getTime())) continue;
    const slot = index.get(utcDayKey(d));
    if (slot !== undefined) buckets[slot].count += e.usd;
  }
  for (const b of buckets) b.count = Math.round(b.count);
  return buckets;
}

/**
 * Sum booked USD by a derived key, descending. Rounds each group to whole dollars.
 * `limit` truncates to the top N.
 */
export function sumByKey(
  entries: ReadonlyArray<RevenueEntry>,
  keyFn: (e: RevenueEntry) => string,
  limit?: number,
): Bucket[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    const key = keyFn(e);
    sums.set(key, (sums.get(key) ?? 0) + e.usd);
  }
  const out = Array.from(sums, ([key, sum]) => ({ key, count: Math.round(sum) })).sort(
    (a, b) => b.count - a.count,
  );
  return limit ? out.slice(0, limit) : out;
}

/** `$1,234` — whole dollars with thousands separators. */
export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** `0x1234…abcd` — a wallet shortened for tables; passthrough for anything else. */
export function shortWallet(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** Feed label for a buy: "Ecosystem · base", "Pro · Indie", "Priority grade · npm/foo". */
export function buyLabel(e: RevenueEntry): string {
  const surface = SURFACE_LABEL[e.surface];
  return e.label ? `${surface} · ${e.label}` : surface;
}
