// web/lib/rankings.test.ts
import { describe, it, expect } from "vitest";
import {
  formatAdoptionSignal,
  dedupeAndRank,
  gradeMapFromRows,
  mergeRankings,
  type JoinedScoreRow,
  type RankedServer,
  type RankingGrade,
} from "./rankings";

function joined(
  versionId: string,
  score: number,
  computedAt: string,
  server: { registry: "npm" | "pypi" | "github"; owner: string | null; name: string } | null,
): JoinedScoreRow {
  return {
    version_id: versionId,
    score,
    components: { npm_downloads_last_month: 1000 },
    computed_at: computedAt,
    versions: server ? { servers: server } : null,
  };
}

describe("formatAdoptionSignal", () => {
  it("prefers npm monthly downloads, compacted", () => {
    expect(formatAdoptionSignal({ npm_downloads_last_month: 1_200_000 })).toBe("1.2M npm/mo");
  });
  it("falls back to pypi, then stars, then dash", () => {
    expect(formatAdoptionSignal({ pypi_downloads_last_month: 340_000 })).toBe("340K pypi/mo");
    expect(formatAdoptionSignal({ gh_stars: 1500 })).toBe("1.5K ★");
    expect(formatAdoptionSignal({})).toBe("—");
  });
});

describe("dedupeAndRank", () => {
  it("dedupes by version_id (newest-first input), sorts by score desc, ranks, and limits", () => {
    const rows = [
      joined("v1", 50, "2026-06-23", { registry: "npm", owner: "@a", name: "x" }),
      joined("v1", 10, "2026-06-22", { registry: "npm", owner: "@a", name: "x" }), // stale dup
      joined("v2", 90, "2026-06-23", { registry: "npm", owner: null, name: "y" }),
      joined("v3", 70, "2026-06-23", { registry: "pypi", owner: null, name: "z" }),
    ];
    const out = dedupeAndRank(rows, 2);
    expect(out.map((r) => [r.rank, r.name])).toEqual([
      [1, "y"],
      [2, "z"],
    ]);
  });
  it("skips rows missing the server FK join rather than throwing", () => {
    const out = dedupeAndRank([joined("v1", 5, "2026-06-23", null)], 10);
    expect(out).toEqual([]);
  });
});

describe("gradeMapFromRows", () => {
  it("keeps the first (newest) published grade per target and drops invalid grades", () => {
    const map = gradeMapFromRows([
      { target: "npm/@a/x", grade: "A", c01: "pass", c02: "pass", c03: "pass" },
      { target: "npm/@a/x", grade: "F", c01: "fail", c02: "pass", c03: "pass" }, // stale
      { target: "pypi/z", grade: null, c01: null, c02: null, c03: null }, // dropped
    ]);
    expect(map.get("npm/@a/x")).toEqual({ grade: "A", c01: "pass", c02: "pass", c03: "pass" });
    expect(map.has("pypi/z")).toBe(false);
  });
});

describe("mergeRankings", () => {
  it("joins ranked servers to grades by serverKey; ungraded → null grade", () => {
    const ranked: RankedServer[] = [
      { rank: 1, registry: "npm", owner: "@a", name: "x", score: 90, components: { gh_stars: 10 } },
      { rank: 2, registry: "pypi", owner: null, name: "z", score: 80, components: {} },
    ];
    const grades = new Map<string, RankingGrade>([
      ["npm/@a/x", { grade: "A", c01: "pass", c02: "skip", c03: "pass" }],
    ]);
    const rows = mergeRankings(ranked, grades);
    expect(rows[0]).toMatchObject({ serverKey: "npm/@a/x", grade: "A", c02: "skip", adoptionSignal: "10 ★" });
    expect(rows[1]).toMatchObject({ serverKey: "pypi/z", grade: null, adoptionSignal: "—" });
  });
});
