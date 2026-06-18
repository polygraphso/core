import { describe, it, expect } from "vitest";
import { bucketByDay, tally, type DayBucket } from "@/lib/adminAggregate";

describe("bucketByDay", () => {
  // Reference "today" = 2026-06-18 (UTC).
  const today = new Date("2026-06-18T12:00:00Z");

  it("returns one ascending bucket per day, including empty days", () => {
    const out = bucketByDay([], 7, today);
    expect(out).toHaveLength(7);
    expect(out[0].date).toBe("2026-06-12");
    expect(out[6].date).toBe("2026-06-18");
    expect(out.every((b: DayBucket) => b.count === 0)).toBe(true);
  });

  it("counts timestamps into their UTC day", () => {
    const out = bucketByDay(
      [
        "2026-06-18T00:01:00Z",
        "2026-06-18T23:59:00Z",
        "2026-06-17T10:00:00Z",
      ],
      7,
      today,
    );
    expect(out.find((b) => b.date === "2026-06-18")!.count).toBe(2);
    expect(out.find((b) => b.date === "2026-06-17")!.count).toBe(1);
  });

  it("ignores timestamps outside the window", () => {
    const out = bucketByDay(["2026-01-01T00:00:00Z"], 7, today);
    expect(out.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it("ignores null/invalid timestamps without throwing", () => {
    const out = bucketByDay(
      [null, undefined, "not-a-date", "2026-06-18T00:00:00Z"] as (string | null)[],
      7,
      today,
    );
    expect(out.find((b) => b.date === "2026-06-18")!.count).toBe(1);
  });
});

describe("tally", () => {
  it("counts and sorts descending", () => {
    const out = tally(["a", "b", "a", "a", "b", "c"]);
    expect(out).toEqual([
      { key: "a", count: 3 },
      { key: "b", count: 2 },
      { key: "c", count: 1 },
    ]);
  });

  it("maps null/empty to a placeholder label", () => {
    const out = tally(["x", null, "", "x"], "—");
    expect(out).toContainEqual({ key: "x", count: 2 });
    expect(out).toContainEqual({ key: "—", count: 2 });
  });

  it("respects an optional limit", () => {
    const out = tally(["a", "a", "b", "c", "d"], "—", 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ key: "a", count: 2 });
  });

  it("returns [] for empty input", () => {
    expect(tally([])).toEqual([]);
  });
});
