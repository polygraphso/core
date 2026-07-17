/**
 * Pure logic + types for the public /transparency page. No I/O, no `server-only`
 * — the onchain/Supabase fetchers in transparencyReads.ts call these, so all the
 * bucketing, distribution, and vesting math is unit-tested in isolation (mirrors
 * the revenueAggregate/revenueMetrics split).
 *
 * PII discipline: the public revenue types below are a deliberate SUBSET of the
 * admin RevenueEntry — no wallet, email, user id, or graded target ever reaches
 * this module or the page. transparency.test.ts fences that with a key check.
 */

import type { DayBucket } from "@/lib/adminAggregate";
import { formatUsd } from "@/lib/revenueAggregate";
import { POLYGRAPH_TOKEN_ADDRESS } from "@/lib/paymentConfig";

// ── The team vesting stream (the tx the founder linked) ──────────────────────
/** Sablier Lockup stream id for the team's linear vesting on Base. */
export const VESTING_STREAM_ID = 716;
/** The creation tx — for the "view on Basescan" link and the cliff read. */
export const VESTING_TX_HASH =
  "0x476e33bcfab067005c8681411c13fc88fde3665cedaa02dcd9e9d3d6ecff436f";
/** Canonical USDC on Base — the x402 rail's currency (6 decimals). */
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ── Revenue (public, PII-free) ───────────────────────────────────────────────

/** The four public revenue lines, in display order. */
export type PublicSurface = "x402" | "grade" | "ecosystem" | "pro";

export const PUBLIC_SURFACE_ORDER: PublicSurface[] = ["x402", "grade", "ecosystem", "pro"];

export const PUBLIC_SURFACE_LABEL: Record<PublicSurface, string> = {
  x402: "x402 (agent USDC)",
  grade: "Grade requests",
  ecosystem: "Ecosystem monitoring",
  pro: "Pro plans",
};

/** One normalized buy, stripped to non-identifying fields only. */
export interface PublicRevenueEntry {
  surface: PublicSurface;
  /** Booked cash — full prepaid stream deposit, or one-time fee. */
  usd: number;
  /** Recurring monthly value for still-active streams; null otherwise. */
  monthly: number | null;
  /** verified_at (streams) / paid_at (fees), ISO. */
  at: string | null;
  /** Whether this is a stream still active with a future end date. */
  active: boolean;
}

export interface RevenueBucket {
  surface: PublicSurface;
  booked: number;
  count: number;
  /** MRR contribution from this surface (active streams only). */
  monthly: number;
}

export interface PublicRevenue {
  buckets: RevenueBucket[];
  totalBooked: number;
  bookedThisMonth: number;
  mrr: number;
  activeSubs: number;
  byDay: DayBucket[];
}

/** Raw stream row (ecosystem or plan), only the columns the public page needs. */
export interface RawStreamRow {
  usd_total: unknown;
  usd_monthly: unknown;
  status: string | null;
  verified_at: string | null;
  end_at: string | null;
}

/** Raw grade-request payment row — `token` splits the x402 vs web rail. */
export interface RawGradeRow {
  usd_price: unknown;
  token: string | null;
  paid_at: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const isActiveStream = (status: string | null, endAt: string | null, now: Date): boolean =>
  status === "active" && endAt != null && new Date(endAt).getTime() > now.getTime();

function streamEntry(surface: PublicSurface, r: RawStreamRow, now: Date): PublicRevenueEntry {
  return {
    surface,
    usd: num(r.usd_total),
    monthly: r.usd_monthly != null ? num(r.usd_monthly) : null,
    at: r.verified_at,
    active: isActiveStream(r.status, r.end_at, now),
  };
}

/** Split a grade-request payment by its settlement token: USDC → x402, else web. */
function gradeSurface(token: string | null): PublicSurface {
  return token && token.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase() ? "x402" : "grade";
}

const utcDayKey = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Sum booked USD into the last `days` UTC days ending on `today` (inclusive).
 * Always exactly `days` ascending, zero-filled buckets; dollars live in `count`
 * so the same MiniBars renderer draws them. Rounds each day to whole dollars.
 */
export function bookedByDay(
  entries: ReadonlyArray<PublicRevenueEntry>,
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
 * Normalize the three payment tables into the public revenue view. Every field
 * that could identify a payer is dropped at this boundary — the returned object
 * carries only aggregates and de-identified entries.
 */
export function buildPublicRevenue(
  input: { eco: RawStreamRow[]; plan: RawStreamRow[]; grade: RawGradeRow[] },
  now: Date,
  windowDays = 30,
): PublicRevenue {
  const entries: PublicRevenueEntry[] = [
    ...input.eco.map((r) => streamEntry("ecosystem", r, now)),
    ...input.plan.map((r) => streamEntry("pro", r, now)),
    ...input.grade.map((r) => ({
      surface: gradeSurface(r.token),
      usd: num(r.usd_price),
      monthly: null,
      at: r.paid_at,
      active: false,
    })),
  ];

  const buckets: RevenueBucket[] = PUBLIC_SURFACE_ORDER.map((surface) => {
    const rows = entries.filter((e) => e.surface === surface);
    return {
      surface,
      booked: Math.round(rows.reduce((s, e) => s + e.usd, 0)),
      count: rows.length,
      monthly: Math.round(rows.reduce((s, e) => s + (e.active ? (e.monthly ?? 0) : 0), 0)),
    };
  });

  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const atMs = (e: PublicRevenueEntry): number => {
    if (!e.at) return 0;
    const t = new Date(e.at).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  return {
    buckets,
    totalBooked: Math.round(entries.reduce((s, e) => s + e.usd, 0)),
    bookedThisMonth: Math.round(
      entries.filter((e) => atMs(e) >= monthStartMs).reduce((s, e) => s + e.usd, 0),
    ),
    mrr: Math.round(entries.reduce((s, e) => s + (e.active ? (e.monthly ?? 0) : 0), 0)),
    activeSubs: entries.filter((e) => e.active).length,
    byDay: bookedByDay(entries, windowDays, now),
  };
}

// ── Tokenomics distribution ──────────────────────────────────────────────────

export type DistributionKey = "team" | "treasury" | "circulating";

export interface DistributionSlice {
  key: DistributionKey;
  label: string;
  amount: number;
  /** Share of total supply, 0..1. */
  pct: number;
}

/**
 * Split total supply into team-locked / treasury / circulating. Circulating is
 * the residual (disclosed on the page): everything not vesting-locked or held by
 * the treasury — i.e. liquidity pools and public holders. Clamped at 0 so a
 * transient read skew can never render a negative slice.
 */
export function distribution(
  totalSupply: number,
  teamLocked: number,
  treasury: number,
): DistributionSlice[] {
  const circulating = Math.max(0, totalSupply - teamLocked - treasury);
  const share = (a: number) => (totalSupply > 0 ? a / totalSupply : 0);
  return [
    { key: "team", label: "Team · locked", amount: teamLocked, pct: share(teamLocked) },
    { key: "treasury", label: "Treasury", amount: treasury, pct: share(treasury) },
    { key: "circulating", label: "Circulating", amount: circulating, pct: share(circulating) },
  ];
}

/** Fraction of a vesting stream that has unlocked per schedule, 0..1. */
export function pctUnlocked(streamed: number, deposited: number): number {
  return deposited > 0 ? Math.min(1, Math.max(0, streamed / deposited)) : 0;
}

// ── Read results (produced by transparencyReads.ts) ──────────────────────────

/** Live state of the team vesting stream, in whole tokens. */
export interface VestingStatus {
  /** Decimal stream id (e.g. "716"). */
  streamId: string;
  txHash: string;
  deposited: number;
  streamed: number;
  withdrawn: number;
  /** deposited − streamed (not yet vested). */
  locked: number;
  /** 0..1 vested per schedule. */
  pctUnlocked: number;
  /** Epoch seconds. */
  startAt: number;
  cliffAt: number | null;
  endAt: number;
  /** Human status: streaming | settled | canceled | depleted | pending. */
  status: string;
}

/** Live tokenomics snapshot, amounts in whole tokens / USD. */
export interface TokenStats {
  contract: string;
  decimals: number;
  totalSupply: number;
  priceUsd: number | null;
  /** price × total supply. */
  fdv: number | null;
  /** price × circulating. */
  marketCap: number | null;
  treasuryAddress: string;
  treasuryPolygraph: number;
  treasuryUsdc: number;
  distribution: DistributionSlice[];
}

// ── Formatting ───────────────────────────────────────────────────────────────

export { formatUsd };

/** `8.87B`, `1.24M`, `12,345` — compact whole-token counts. */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return Math.round(n).toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** `$8.9M`, `$12.3K`, `$742` — compact USD for FDV / market cap. */
export function formatUsdCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return formatUsd(n);
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const toSubscript = (n: number): string =>
  String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join("");

/**
 * Token spot price in the DexScreener style: `$1.50` at/above a dollar, plain
 * 6 decimals down to a tenth of a cent, and below that the subscript-zero
 * notation — `$0.0₆5050` for 0.0000005050, where ₆ is the count of leading
 * zeros after the decimal and the four significant figures follow.
 */
export function formatPriceUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1)
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.001) return `$${n.toFixed(6)}`;
  const exp = Math.floor(Math.log10(n)); // e.g. -7 for 5.05e-7
  const leadingZeros = -exp - 1; // zeros after the decimal before the first sig digit
  const sig = Math.round(n / Math.pow(10, exp - 3)); // four significant figures → 5050
  return `$0.0${toSubscript(leadingZeros)}${sig}`;
}

/** `12.0%` from a 0..1 fraction. */
export function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}
