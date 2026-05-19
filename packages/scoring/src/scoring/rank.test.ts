import { describe, it, expect } from "vitest";
import { assignTier, rankAndTier, type RankInput } from "./rank.js";

function input(id: string, adoption: number, risk = 0): RankInput {
  return {
    server_id: id,
    version_id: `v-${id}`,
    raw: {
      adoption,
      quality: 0.7,
      consistency: 0.7,
      risk,
      sources_used: ["npm"],
      redistribution: { adoption: { structurally_absent: [], scale_factor: 1 } },
    },
  };
}

describe("assignTier", () => {
  it("maps ranks to tiers per the brief's boundaries", () => {
    expect(assignTier(1)).toBe("top10");
    expect(assignTier(10)).toBe("top10");
    expect(assignTier(11)).toBe("top25");
    expect(assignTier(25)).toBe("top25");
    expect(assignTier(26)).toBe("top50");
    expect(assignTier(50)).toBe("top50");
    expect(assignTier(51)).toBe("top100");
    expect(assignTier(100)).toBe("top100");
    expect(assignTier(101)).toBeNull();
  });
});

describe("rankAndTier", () => {
  it("returns an empty array on empty input", () => {
    expect(rankAndTier([])).toEqual([]);
  });

  it("sorts by score descending and assigns ranks 1..N", () => {
    const out = rankAndTier([input("a", 1), input("b", 5), input("c", 3)]);
    expect(out.map((s) => s.server_id)).toEqual(["b", "c", "a"]);
    expect(out.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it("breaks score ties by server_id ascending (deterministic across runs)", () => {
    // Three servers with identical raw dimensions → identical scores.
    const out = rankAndTier([input("c", 5), input("a", 5), input("b", 5)]);
    expect(out.map((s) => s.server_id)).toEqual(["a", "b", "c"]);
  });

  it("assigns tiers correctly for a 30-server batch", () => {
    const inputs: RankInput[] = Array.from({ length: 30 }, (_, i) =>
      input(`s${String(i).padStart(2, "0")}`, 30 - i),
    );
    const out = rankAndTier(inputs);
    expect(out.filter((s) => s.tier === "top10")).toHaveLength(10);
    expect(out.filter((s) => s.tier === "top25")).toHaveLength(15);
    expect(out.filter((s) => s.tier === "top50")).toHaveLength(5);
    expect(out.filter((s) => s.tier === "top100")).toHaveLength(0);
  });

  it("subtracts the risk term and clamps the final score to [0, 100]", () => {
    const safe = rankAndTier([input("safe", 10, 0)])[0]!;
    const risky = rankAndTier([input("risky", 10, 100)])[0]!;
    // With identical raw inputs but different risk, the risky version's
    // score must be lower (potentially clamped at 0).
    expect(risky.score).toBeLessThan(safe.score);
    expect(risky.score).toBeGreaterThanOrEqual(0);
    expect(safe.score).toBeLessThanOrEqual(100);
  });

  it("preserves the WEIGHTS structure (lifted from agentic-talent-app)", () => {
    // Sanity check the formula ceiling. WEIGHTS sum to 3*0.28 = 0.84 across
    // the three positive dimensions, so the max achievable score (all dims
    // normalized to 100, zero risk) is 84 — the [0,100] clamp is defensive,
    // not the actual ceiling. To get there we need diverse quality and
    // consistency across the batch so normalization doesn't collapse to
    // midpoint.
    const diverse = (id: string, a: number, q: number, c: number): RankInput => ({
      server_id: id,
      version_id: `v-${id}`,
      raw: {
        adoption: a,
        quality: q,
        consistency: c,
        risk: 0,
        sources_used: ["npm"],
        redistribution: { adoption: { structurally_absent: [], scale_factor: 1 } },
      },
    });
    const out = rankAndTier([
      diverse("hi", 10, 1.0, 1.0),
      diverse("mid", 5, 0.5, 0.5),
      diverse("lo", 1, 0.1, 0.1),
    ]);
    expect(out[0]!.score).toBeCloseTo(84, 1);
    expect(out[0]!.score).toBeLessThanOrEqual(100);
  });
});
