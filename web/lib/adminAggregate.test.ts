import { describe, it, expect } from "vitest";
import {
  bucketByDay,
  tally,
  summarizeLookups,
  summarizeAgentActivity,
  type DayBucket,
} from "@/lib/adminAggregate";

describe("summarizeAgentActivity", () => {
  const today = new Date("2026-07-03T12:00:00Z");
  const rows = [
    { day: "2026-07-03", agent_name: "claude-code", endpoint: "check", hit_count: 5, miss_count: 2, call_count: 7 },
    { day: "2026-07-03", agent_name: "claude-code", endpoint: "grade_request", hit_count: 0, miss_count: 0, call_count: 1 },
    { day: "2026-07-02", agent_name: "ua:curl", endpoint: "check", hit_count: 1, miss_count: 0, call_count: 1 },
  ];

  it("zero-fills a per-day call series over the window", () => {
    const s = summarizeAgentActivity(rows, 3, today);
    expect(s.perDay).toEqual([
      { date: "2026-07-01", count: 0 },
      { date: "2026-07-02", count: 1 },
      { date: "2026-07-03", count: 8 },
    ]);
  });

  it("ranks agents and endpoints by total calls", () => {
    const s = summarizeAgentActivity(rows, 3, today);
    expect(s.byAgent).toEqual([
      { key: "claude-code", count: 8 },
      { key: "ua:curl", count: 1 },
    ]);
    expect(s.byEndpoint[0]).toEqual({ key: "check", count: 8 });
  });

  it("ignores rows outside the window and handles empty input", () => {
    const s = summarizeAgentActivity(
      [{ day: "2026-06-01", agent_name: "old", endpoint: "check", hit_count: 1, miss_count: 0, call_count: 1 }],
      3,
      today,
    );
    expect(s.byAgent).toEqual([]);
    expect(s.perDay.every((b) => b.count === 0)).toBe(true);
    expect(summarizeAgentActivity([], 3, today).byEndpoint).toEqual([]);
  });
});

describe("summarizeLookups", () => {
  const rows = [
    { server_ref: "npm/a", hit_count: 8, miss_count: 2 }, // total 10
    { server_ref: "npm/b", hit_count: 1, miss_count: 4 }, // total 5
    { server_ref: "npm/c", hit_count: 0, miss_count: 1 }, // total 1
  ];

  it("sums hits, misses, and the hit rate across servers", () => {
    const s = summarizeLookups(rows);
    expect(s.totalLookups).toBe(16);
    expect(s.hits).toBe(9);
    expect(s.misses).toBe(7);
    expect(s.hitRate).toBeCloseTo(9 / 16);
    expect(s.distinctServers).toBe(3);
  });

  it("ranks top servers by total lookups and honors the limit", () => {
    const s = summarizeLookups(rows, 2);
    expect(s.topServers.map((t) => t.server_ref)).toEqual(["npm/a", "npm/b"]);
    expect(s.topServers[0]).toMatchObject({ total: 10, hits: 8, misses: 2 });
  });

  it("returns zeros and a null hit rate when there is no data", () => {
    const s = summarizeLookups([]);
    expect(s.totalLookups).toBe(0);
    expect(s.hitRate).toBeNull();
    expect(s.topServers).toEqual([]);
    expect(s.distinctServers).toBe(0);
  });
});

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
