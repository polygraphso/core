import { describe, it, expect } from "vitest";
import {
  buildPublicRevenue,
  bookedByDay,
  distribution,
  pctUnlocked,
  formatTokens,
  formatUsdCompact,
  formatPriceUsd,
  formatPct,
  USDC_BASE_ADDRESS,
  type RawStreamRow,
  type RawGradeRow,
  type PublicRevenueEntry,
} from "@/lib/transparency";

const NOW = new Date("2026-07-17T12:00:00Z");

const activeStream = (over: Partial<RawStreamRow> = {}): RawStreamRow => ({
  usd_total: 199,
  usd_monthly: 199,
  status: "active",
  verified_at: "2026-07-10T00:00:00Z",
  end_at: "2026-08-10T00:00:00Z", // future relative to NOW
  ...over,
});

describe("buildPublicRevenue", () => {
  it("splits grade payments into x402 (USDC) vs web (POLYGRAPH) by token", () => {
    const grade: RawGradeRow[] = [
      { usd_price: 1, token: USDC_BASE_ADDRESS, paid_at: "2026-07-16T00:00:00Z" },
      { usd_price: 1, token: USDC_BASE_ADDRESS.toUpperCase(), paid_at: "2026-07-16T00:00:00Z" },
      { usd_price: 1, token: "0x2878cfc54aabdadd9bb5d70dd24d6b91485afba3", paid_at: "2026-07-16T00:00:00Z" },
    ];
    const r = buildPublicRevenue({ eco: [], plan: [], grade }, NOW);
    const x402 = r.buckets.find((b) => b.surface === "x402")!;
    const web = r.buckets.find((b) => b.surface === "grade")!;
    expect(x402.count).toBe(2); // USDC, case-insensitive
    expect(web.count).toBe(1); // POLYGRAPH
    expect(x402.booked).toBe(2);
    expect(web.booked).toBe(1);
  });

  it("books stream deposits, counts active subs, and sums MRR from active streams only", () => {
    const eco = [activeStream({ usd_total: 2388, usd_monthly: 199 })];
    const plan = [
      activeStream({ usd_total: 15, usd_monthly: 15 }),
      // canceled stream: booked cash counts, but not MRR and not an active sub
      activeStream({ usd_total: 79, usd_monthly: 79, status: "canceled", end_at: null }),
    ];
    const r = buildPublicRevenue({ eco, plan, grade: [] }, NOW);
    expect(r.totalBooked).toBe(2388 + 15 + 79);
    expect(r.mrr).toBe(199 + 15); // canceled excluded
    expect(r.activeSubs).toBe(2); // eco + indie active; canceled not counted
    const pro = r.buckets.find((b) => b.surface === "pro")!;
    expect(pro.booked).toBe(15 + 79);
    expect(pro.monthly).toBe(15); // active only
  });

  it("counts this-month booked against the UTC month start", () => {
    const eco = [
      activeStream({ usd_total: 100, verified_at: "2026-07-01T00:00:00Z" }), // this month
      activeStream({ usd_total: 50, verified_at: "2026-06-30T23:59:59Z" }), // last month
    ];
    const r = buildPublicRevenue({ eco, plan: [], grade: [] }, NOW);
    expect(r.totalBooked).toBe(150);
    expect(r.bookedThisMonth).toBe(100);
  });

  it("always returns all four surface buckets, in order, even at zero", () => {
    const r = buildPublicRevenue({ eco: [], plan: [], grade: [] }, NOW);
    expect(r.buckets.map((b) => b.surface)).toEqual(["x402", "grade", "ecosystem", "pro"]);
    expect(r.totalBooked).toBe(0);
    expect(r.mrr).toBe(0);
    expect(r.activeSubs).toBe(0);
    expect(r.byDay).toHaveLength(30);
    expect(r.byDay.every((d) => d.count === 0)).toBe(true);
  });

  it("leaks no payer-identifying fields (public-surface PII fence)", () => {
    const r = buildPublicRevenue(
      { eco: [activeStream()], plan: [activeStream()], grade: [{ usd_price: 1, token: null, paid_at: NOW.toISOString() }] },
      NOW,
    );
    const forbidden = ["payer", "payer_address", "userId", "user_id", "userEmail", "email", "target", "tx_hash", "wallet"];
    const scan = (obj: unknown) => {
      const json = JSON.stringify(obj);
      for (const key of forbidden) {
        expect(json.includes(`"${key}"`)).toBe(false);
      }
    };
    scan(r);
    scan(r.buckets);
  });
});

describe("bookedByDay", () => {
  it("zero-fills the window and lands dollars on the right UTC day", () => {
    const entries: PublicRevenueEntry[] = [
      { surface: "ecosystem", usd: 199, monthly: 199, at: "2026-07-17T09:00:00Z", active: true },
      { surface: "pro", usd: 15, monthly: 15, at: "2026-07-16T23:59:00Z", active: true },
      { surface: "grade", usd: 1, monthly: null, at: "2026-01-01T00:00:00Z", active: false }, // out of window
    ];
    const days = bookedByDay(entries, 30, NOW);
    expect(days).toHaveLength(30);
    expect(days[days.length - 1]).toEqual({ date: "2026-07-17", count: 199 });
    expect(days[days.length - 2]).toEqual({ date: "2026-07-16", count: 15 });
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(214); // out-of-window ignored
  });
});

describe("distribution", () => {
  it("makes circulating the residual and shares sum to 1", () => {
    const slices = distribution(100, 60, 10);
    expect(slices.map((s) => s.amount)).toEqual([60, 10, 30]);
    expect(slices.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(1, 10);
    expect(slices.find((s) => s.key === "circulating")!.pct).toBeCloseTo(0.3, 10);
  });

  it("clamps circulating at zero when locked + treasury exceed supply", () => {
    const slices = distribution(100, 80, 40);
    expect(slices.find((s) => s.key === "circulating")!.amount).toBe(0);
  });

  it("returns zero shares (no NaN) when supply is zero", () => {
    const slices = distribution(0, 0, 0);
    expect(slices.every((s) => s.pct === 0)).toBe(true);
  });
});

describe("pctUnlocked", () => {
  it("is streamed / deposited, clamped to 0..1", () => {
    expect(pctUnlocked(12, 100)).toBeCloseTo(0.12, 10);
    expect(pctUnlocked(0, 0)).toBe(0);
    expect(pctUnlocked(150, 100)).toBe(1);
  });
});

describe("formatters", () => {
  it("formatTokens is compact", () => {
    expect(formatTokens(8_868_236_887)).toBe("8.87B");
    expect(formatTokens(1_240_000)).toBe("1.24M");
    expect(formatTokens(12_345)).toBe("12,345");
    expect(formatTokens(NaN)).toBe("—");
  });

  it("formatUsdCompact scales", () => {
    expect(formatUsdCompact(8_900_000)).toBe("$8.90M");
    expect(formatUsdCompact(12_300)).toBe("$12.3K");
    expect(formatUsdCompact(742)).toBe("$742");
  });

  it("formatPriceUsd uses DexScreener subscript-zero notation for tiny prices", () => {
    expect(formatPriceUsd(0.000000505)).toBe("$0.0₆5050");
    expect(formatPriceUsd(0.00000498)).toBe("$0.0₅4980");
    expect(formatPriceUsd(0.06505)).toBe("$0.065050"); // tenth-of-a-cent and up: plain 6 decimals
    expect(formatPriceUsd(0)).toBe("—");
    expect(formatPriceUsd(1.5)).toBe("$1.50");
  });

  it("formatPct renders one decimal", () => {
    expect(formatPct(0.12)).toBe("12.0%");
  });
});
