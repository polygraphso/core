// web/lib/rankings.test.ts
import { describe, it, expect } from "vitest";
import {
  formatAdoptionSignal,
  adoptionMetrics,
  dedupeAndRank,
  gradeMapFromRows,
  mergeRankings,
  type JoinedScoreRow,
  type RankedServer,
  type RankingGrade,
} from "./rankings";

function joined(
  versionId: string,
  adoption: number,
  computedAt: string,
  server: { registry: "npm" | "pypi" | "github"; owner: string | null; name: string } | null,
): JoinedScoreRow {
  return {
    version_id: versionId,
    score: adoption, // composite kept = adoption for these fixtures; adoption is the rank key
    components: { npm_downloads_last_month: 1000, dimensions: { adoption } },
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
  it("drops fractional noise for large thousands (331K not 331.1K)", () => {
    expect(formatAdoptionSignal({ npm_downloads_last_month: 331_100 })).toBe("331K npm/mo");
  });
});

describe("adoptionMetrics", () => {
  it("lists present signals with labels and formatting, skipping absent ones", () => {
    const m = adoptionMetrics({
      npm_downloads_last_month: 1_145_441,
      gh_stars: 87_634,
      gh_forks: null,
      depsdev_dependents_count: 18,
      npm_last_publish_date: "2026-01-14T16:03:10.655Z",
    });
    expect(m).toEqual([
      { label: "npm downloads (30d)", value: "1,145,441" },
      { label: "GitHub stars", value: "87,634" },
      { label: "Dependents (deps.dev)", value: "18" },
      { label: "Last published", value: "2026-01-14" },
    ]);
  });
});

describe("dedupeAndRank", () => {
  it("sorts by adoption desc, assigns ranks, and limits", () => {
    const rows = [
      joined("v2", 90, "2026-06-24", { registry: "npm", owner: null, name: "y" }),
      joined("v3", 70, "2026-06-24", { registry: "pypi", owner: null, name: "z" }),
      joined("v1", 50, "2026-06-24", { registry: "npm", owner: "@a", name: "x" }),
    ];
    const out = dedupeAndRank(rows, 2);
    expect(out.map((r) => [r.rank, r.name])).toEqual([[1, "y"], [2, "z"]]);
  });

  it("dedupes by SERVER across versions, keeping the newest-scored row (input is computed_at desc)", () => {
    const rows = [
      joined("vNew", 60, "2026-06-24", { registry: "npm", owner: "@a", name: "x" }),
      joined("vOld", 80, "2026-05-19", { registry: "npm", owner: "@a", name: "x" }),
      joined("v2", 50, "2026-06-24", { registry: "npm", owner: null, name: "y" }),
    ];
    const out = dedupeAndRank(rows, 10);
    expect(out.filter((r) => r.name === "x")).toHaveLength(1);
    // kept the newest version's row (adoption 60), not the stale higher-adoption one (80)
    expect(out.map((r) => [r.name, r.adoptionScore])).toEqual([["x", 60], ["y", 50]]);
  });

  it("ranks by the adoption dimension, not the composite score", () => {
    // "popular" has a LOWER composite score but HIGHER adoption; it must still rank first.
    const popular: JoinedScoreRow = {
      version_id: "vp",
      score: 50,
      components: { dimensions: { adoption: 100 } },
      computed_at: "2026-06-24",
      versions: { servers: { registry: "npm", owner: null, name: "popular" } },
    };
    const polished: JoinedScoreRow = {
      version_id: "vq",
      score: 90,
      components: { dimensions: { adoption: 40 } },
      computed_at: "2026-06-24",
      versions: { servers: { registry: "npm", owner: null, name: "polished" } },
    };
    const out = dedupeAndRank([polished, popular], 10);
    expect(out.map((r) => r.name)).toEqual(["popular", "polished"]);
  });

  it("skips rows missing the server FK join rather than throwing", () => {
    const out = dedupeAndRank([joined("v1", 5, "2026-06-24", null)], 10);
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
      { rank: 1, registry: "npm", owner: "@a", name: "x", score: 90, adoptionScore: 95, computedAt: "2026-06-24", components: { gh_stars: 10 } },
      { rank: 2, registry: "pypi", owner: null, name: "z", score: 80, adoptionScore: 60, computedAt: "2026-06-24", components: {} },
    ];
    const grades = new Map<string, RankingGrade>([
      ["npm/@a/x", { grade: "A", c01: "pass", c02: "skip", c03: "pass" }],
    ]);
    const rows = mergeRankings(ranked, grades);
    expect(rows[0]).toMatchObject({ serverKey: "npm/@a/x", grade: "A", c02: "skip", adoptionSignal: "10 ★", adoptionScore: 95 });
    expect(rows[1]).toMatchObject({ serverKey: "pypi/z", grade: null, adoptionSignal: "—", adoptionScore: 60 });
  });
});
