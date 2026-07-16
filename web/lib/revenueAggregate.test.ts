import { describe, it, expect } from "vitest";
import {
  sumByDay,
  sumByKey,
  formatUsd,
  shortWallet,
  buyLabel,
  type RevenueEntry,
} from "@/lib/revenueAggregate";

function entry(partial: Partial<RevenueEntry>): RevenueEntry {
  return {
    surface: "ecosystem",
    label: "",
    usd: 0,
    monthly: null,
    at: "2026-07-03T12:00:00Z",
    endAt: null,
    payer: null,
    userId: null,
    userEmail: null,
    status: "active",
    recurring: true,
    ...partial,
  };
}

describe("sumByDay", () => {
  const today = new Date("2026-07-03T12:00:00Z");

  it("returns one ascending, zero-filled bucket per day", () => {
    const out = sumByDay([], 3, today);
    expect(out).toEqual([
      { date: "2026-07-01", count: 0 },
      { date: "2026-07-02", count: 0 },
      { date: "2026-07-03", count: 0 },
    ]);
  });

  it("sums booked USD into the entry's UTC day", () => {
    const out = sumByDay(
      [
        entry({ at: "2026-07-03T00:01:00Z", usd: 2388 }),
        entry({ at: "2026-07-03T23:59:00Z", usd: 99 }),
        entry({ at: "2026-07-02T10:00:00Z", usd: 180 }),
      ],
      3,
      today,
    );
    expect(out.find((b) => b.date === "2026-07-03")!.count).toBe(2487);
    expect(out.find((b) => b.date === "2026-07-02")!.count).toBe(180);
    expect(out.find((b) => b.date === "2026-07-01")!.count).toBe(0);
  });

  it("rounds daily totals to whole dollars", () => {
    const out = sumByDay(
      [entry({ at: "2026-07-03T00:00:00Z", usd: 10.4 }), entry({ at: "2026-07-03T00:00:00Z", usd: 10.4 })],
      1,
      today,
    );
    expect(out[0].count).toBe(21);
  });

  it("ignores out-of-window and null/invalid dates", () => {
    const out = sumByDay(
      [
        entry({ at: "2026-01-01T00:00:00Z", usd: 999 }),
        entry({ at: "not-a-date", usd: 999 }),
        entry({ at: "2026-07-03T00:00:00Z", usd: 50 }),
      ],
      3,
      today,
    );
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(50);
  });
});

describe("sumByKey", () => {
  const rows = [
    entry({ surface: "ecosystem", usd: 2388 }),
    entry({ surface: "team", usd: 948 }),
    entry({ surface: "indie", usd: 180 }),
    entry({ surface: "team", usd: 948 }),
  ];

  it("sums USD by a derived key, descending", () => {
    const out = sumByKey(rows, (e) => e.surface);
    expect(out).toEqual([
      { key: "ecosystem", count: 2388 },
      { key: "team", count: 1896 },
      { key: "indie", count: 180 },
    ]);
  });

  it("ranks and honors the limit", () => {
    const out = sumByKey(rows, (e) => e.surface, 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ key: "ecosystem", count: 2388 });
    expect(out[1]).toEqual({ key: "team", count: 1896 });
  });

  it("returns [] for empty input", () => {
    expect(sumByKey([], (e) => e.surface)).toEqual([]);
  });
});

describe("formatUsd", () => {
  it("renders whole dollars with separators", () => {
    expect(formatUsd(2388)).toBe("$2,388");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(15.4)).toBe("$15");
    expect(formatUsd(1234567)).toBe("$1,234,567");
  });
});

describe("shortWallet", () => {
  it("shortens a 0x address", () => {
    expect(shortWallet("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
  it("passes short strings through", () => {
    expect(shortWallet("0xabcd")).toBe("0xabcd");
  });
});

describe("buyLabel", () => {
  it("joins surface and specific label", () => {
    expect(buyLabel(entry({ surface: "ecosystem", label: "base" }))).toBe("Ecosystem · base");
    expect(buyLabel(entry({ surface: "priority", label: "npm/foo" }))).toBe("Priority grade · npm/foo");
  });
  it("uses the surface alone when there is no specific label", () => {
    expect(buyLabel(entry({ surface: "indie", label: "" }))).toBe("Pro · Indie");
  });
});
