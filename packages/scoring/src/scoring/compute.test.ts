import { describe, it, expect } from "vitest";
import {
  adoptionWithRedistribution,
  advisoryRiskFromSeverities,
  buildSharedRepoMask,
  computeDownloadVelocity,
  computeRawDimensions,
} from "./compute.js";
import type { ComponentSnapshot } from "./types.js";

function snap(overrides: Partial<ComponentSnapshot> = {}): ComponentSnapshot {
  return {
    server_id: "s1",
    version_id: "v1",
    github_repo_key: null,
    npm: null,
    pypi: null,
    github: null,
    openssf: null,
    depsdev: null,
    glama: null,
    smithery: null,
    ...overrides,
  };
}

describe("computeDownloadVelocity", () => {
  it("returns 50 (neutral) when fewer than 8 weeks of data", () => {
    expect(computeDownloadVelocity(null)).toBe(50);
    expect(computeDownloadVelocity([100, 100, 100])).toBe(50);
  });

  it("returns 50 when recent equals prior", () => {
    expect(computeDownloadVelocity([100, 100, 100, 100, 100, 100, 100, 100])).toBe(50);
  });

  it("returns 100 when last 4 weeks doubled vs prior", () => {
    expect(computeDownloadVelocity([100, 100, 100, 100, 200, 200, 200, 200])).toBe(100);
  });

  it("returns 100 when prior was 0 and recent is positive", () => {
    expect(computeDownloadVelocity([0, 0, 0, 0, 100, 100, 100, 100])).toBe(100);
  });

  it("returns 0 when activity collapses to nothing", () => {
    expect(computeDownloadVelocity([100, 100, 100, 100, 0, 0, 0, 0])).toBe(0);
  });
});

describe("advisoryRiskFromSeverities", () => {
  it("sums severity points and caps at 50", () => {
    expect(advisoryRiskFromSeverities([])).toBe(0);
    expect(advisoryRiskFromSeverities(["LOW"])).toBe(3);
    expect(advisoryRiskFromSeverities(["HIGH", "MODERATE", "LOW"])).toBe(15 + 8 + 3);
    expect(advisoryRiskFromSeverities(["CRITICAL", "CRITICAL", "CRITICAL"])).toBe(50);
  });
});

describe("adoptionWithRedistribution", () => {
  it("returns 0 with scale_factor=null when every signal is absent", () => {
    const result = adoptionWithRedistribution([
      { name: "a", weight: 0.5, value: 10, present: false },
      { name: "b", weight: 0.5, value: 5, present: false },
    ]);
    expect(result).toEqual({ score: 0, absent: ["a", "b"], scale_factor: null });
  });

  it("returns the weighted sum unchanged when every signal is present", () => {
    const result = adoptionWithRedistribution([
      { name: "a", weight: 0.6, value: 10, present: true },
      { name: "b", weight: 0.4, value: 5, present: true },
    ]);
    // Sum of weights = 1, scale_factor = 1, score = 10*0.6 + 5*0.4 = 8.
    expect(result.score).toBe(8);
    expect(result.absent).toEqual([]);
    expect(result.scale_factor).toBe(1);
  });

  it("redistributes absent weight proportionally across present signals", () => {
    // Three signals, the absent one (0.4 weight) gets split across the
    // present ones. Present weights: 0.3 + 0.3 = 0.6. Scale = 1/0.6 ≈ 1.667.
    // Score = 10 * 0.3 * 1.667 + 6 * 0.3 * 1.667 = 5 + 3 = 8.
    const result = adoptionWithRedistribution([
      { name: "a", weight: 0.3, value: 10, present: true },
      { name: "b", weight: 0.4, value: 0, present: false },
      { name: "c", weight: 0.3, value: 6, present: true },
    ]);
    expect(result.score).toBeCloseTo(8, 5);
    expect(result.absent).toEqual(["b"]);
    expect(result.scale_factor).toBeCloseTo(1.667, 2);
  });

  it("preserves the relative weighting between present signals", () => {
    // High-weight present signal should dominate. a has 4x b's weight.
    const result = adoptionWithRedistribution([
      { name: "a", weight: 0.4, value: 10, present: true },
      { name: "b", weight: 0.1, value: 10, present: true },
      { name: "absent", weight: 0.5, value: 0, present: false },
    ]);
    // Scale 1/0.5 = 2. Score = 10*0.4*2 + 10*0.1*2 = 8 + 2 = 10.
    expect(result.score).toBeCloseTo(10, 5);
  });
});

describe("buildSharedRepoMask", () => {
  it("flags github_repo_key values that appear on 2+ servers", () => {
    const a = snap({ server_id: "a", github_repo_key: "mc/servers" });
    const b = snap({ server_id: "b", github_repo_key: "mc/servers" });
    const c = snap({ server_id: "c", github_repo_key: "anthropic/foo" });
    const d = snap({ server_id: "d", github_repo_key: null });
    expect(buildSharedRepoMask([a, b, c, d])).toEqual(new Set(["mc/servers"]));
  });

  it("returns empty when no repos are shared", () => {
    expect(buildSharedRepoMask([snap({ github_repo_key: "x/y" })])).toEqual(new Set());
  });
});

describe("computeRawDimensions", () => {
  const opts = { shared_github_repos: new Set<string>(), now: new Date("2026-06-01").getTime() };

  it("returns the empty-snapshot signature with all adoption signals flagged absent", () => {
    const result = computeRawDimensions(snap(), opts);
    // Adoption: every signal is structurally absent → score collapses to 0
    // (no present signals to redistribute weight across).
    expect(result.adoption).toBe(0);
    expect(result.redistribution.adoption.scale_factor).toBeNull();
    expect(result.redistribution.adoption.structurally_absent).toEqual(
      expect.arrayContaining(["npm", "pypi", "smithery_use_count", "gh_stars", "velocity", "depsdev_dependents"]),
    );
    // Quality: no PR-merge-rate, no OpenSSF — weightedAverage of all-null
    // returns 0.5 (the neutral fallback).
    expect(result.quality).toBe(0.5);
    expect(result.consistency).toBe(0);
    expect(result.risk).toBeGreaterThanOrEqual(40);
    expect(result.sources_used).toEqual([]);
  });

  it("treats null PR counts (search failed) as structurally absent for quality", () => {
    // When github's /search/issues fails (e.g. 422 on niche repos), the
    // adapter returns null PR counts. compute must NOT count this as "0
    // PRs" (which would falsely depress the merge-rate signal) — it must
    // skip the signal entirely and let weightedAverage redistribute.
    const ghShape = {
      owner: "aws",
      repo: "aws-mcp-proxy",
      stars: 5,
      forks: 1,
      contributors_count: 3,
      archived: false,
      last_push_at: "2026-05-01T00:00:00Z",
      created_at: "2026-04-01T00:00:00Z",
      commit_activity_last_year: [],
      has_security_md: false,
      has_contributing_md: false,
      release_count_last_year: 0,
      avg_days_between_releases: null,
    };

    // OpenSSF carries the quality dimension when PR-merge-rate is absent.
    const openssfShape = {
      owner: "aws",
      repo: "aws-mcp-proxy",
      aggregate_score: 8,
      checks: {},
    };

    const withNullPRs = computeRawDimensions(
      snap({
        github: { ...ghShape, pr_count_open: null, pr_count_closed: null },
        openssf: openssfShape,
      }),
      opts,
    );
    const withZeroPRs = computeRawDimensions(
      snap({
        github: { ...ghShape, pr_count_open: 0, pr_count_closed: 0 },
        openssf: openssfShape,
      }),
      opts,
    );

    // With null PR counts: weightedAverage skips the missing signal and
    // quality reflects OpenSSF alone (0.8). With "actually 0 PRs":
    // pr_merge_rate is still null (totalPRs is 0), same fallback path.
    // The two should match — that's exactly the property we want when
    // both inputs mean "we have no merge-rate information for this repo."
    expect(withNullPRs.quality).toBeCloseTo(withZeroPRs.quality, 5);
    // But the distinction matters for repos where compute might later
    // care about "we tried and got zero" vs "we couldn't even ask."
    // Document via a stable snapshot check on the OpenSSF-only quality.
    expect(withNullPRs.quality).toBeCloseTo(0.8, 5);
  });

  it("reports smithery as structurally absent when the adapter returned null", () => {
    const result = computeRawDimensions(
      snap({
        npm: {
          package_name: "x",
          latest_version: "1.0.0",
          last_publish_date: "2026-05-01T00:00:00Z",
          deprecated: false,
          github_owner_repo: null,
          downloads_last_month: 1_000_000,
          weekly_downloads: [],
        },
        smithery: null,
      }),
      opts,
    );
    expect(result.redistribution.adoption.structurally_absent).toContain("smithery_use_count");
    expect(result.redistribution.adoption.scale_factor).toBeGreaterThan(1);
    // Adoption is non-zero because npm is present.
    expect(result.adoption).toBeGreaterThan(0);
  });

  it("scales adoption with npm downloads and stars", () => {
    const lowDl = computeRawDimensions(
      snap({
        npm: {
          package_name: "x",
          latest_version: "1.0.0",
          last_publish_date: "2026-05-01T00:00:00Z",
          deprecated: false,
          github_owner_repo: null,
          downloads_last_month: 100,
          weekly_downloads: [],
        },
      }),
      opts,
    );
    const highDl = computeRawDimensions(
      snap({
        npm: {
          package_name: "x",
          latest_version: "1.0.0",
          last_publish_date: "2026-05-01T00:00:00Z",
          deprecated: false,
          github_owner_repo: null,
          downloads_last_month: 10_000_000,
          weekly_downloads: [],
        },
      }),
      opts,
    );
    expect(highDl.adoption).toBeGreaterThan(lowDl.adoption);
  });

  it("masks github signals when github_repo_key is in the shared set", () => {
    const sharedSnap = snap({
      server_id: "a",
      github_repo_key: "mc/servers",
      github: {
        owner: "mc",
        repo: "servers",
        stars: 50000,
        forks: 5000,
        contributors_count: 300,
        archived: false,
        last_push_at: "2026-05-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        pr_count_open: 100,
        pr_count_closed: 1000,
        commit_activity_last_year: [],
        has_security_md: false,
        has_contributing_md: false,
        release_count_last_year: 0,
        avg_days_between_releases: null,
      },
    });
    const unmasked = computeRawDimensions(sharedSnap, opts);
    const masked = computeRawDimensions(sharedSnap, {
      ...opts,
      shared_github_repos: new Set(["mc/servers"]),
    });

    // Masking removes star contribution from adoption + PR merge rate from quality.
    expect(masked.adoption).toBeLessThan(unmasked.adoption);
    expect(masked.sources_used).not.toContain("github");
    expect(unmasked.sources_used).toContain("github");
  });

  it("adds CVSS-weighted risk from advisory severities (the load-bearing brief callout)", () => {
    const lowRisk = computeRawDimensions(
      snap({
        depsdev: {
          ecosystem: "npm",
          package_name: "x",
          latest_version: "1.0.0",
          dependents_count: 0,
          advisory_count: 1,
          max_advisory_severity: "LOW",
          advisory_severities: ["LOW"],
          has_slsa_provenance: false,
          license_detected: null,
        },
      }),
      opts,
    );
    const criticalRisk = computeRawDimensions(
      snap({
        depsdev: {
          ecosystem: "npm",
          package_name: "x",
          latest_version: "1.0.0",
          dependents_count: 0,
          advisory_count: 3,
          max_advisory_severity: "CRITICAL",
          advisory_severities: ["CRITICAL", "CRITICAL", "HIGH"],
          has_slsa_provenance: false,
          license_detected: null,
        },
      }),
      opts,
    );
    expect(criticalRisk.risk).toBeGreaterThan(lowRisk.risk);
  });

  it("reduces risk for OpenSSF aggregate, zero advisories, license, and SLSA presence", () => {
    const noBonus = computeRawDimensions(snap(), opts);
    const allBonuses = computeRawDimensions(
      snap({
        openssf: {
          owner: "x",
          repo: "y",
          aggregate_score: 9,
          checks: {},
        },
        depsdev: {
          ecosystem: "npm",
          package_name: "x",
          latest_version: "1.0.0",
          dependents_count: 0,
          advisory_count: 0,
          max_advisory_severity: null,
          advisory_severities: [],
          has_slsa_provenance: true,
          license_detected: "MIT",
        },
      }),
      opts,
    );
    expect(allBonuses.risk).toBeLessThan(noBonus.risk);
  });

  it("flags deprecated packages with high risk", () => {
    const result = computeRawDimensions(
      snap({
        npm: {
          package_name: "x",
          latest_version: "1.0.0",
          last_publish_date: "2026-05-01T00:00:00Z",
          deprecated: true,
          github_owner_repo: null,
          downloads_last_month: 100,
          weekly_downloads: [],
        },
      }),
      opts,
    );
    expect(result.risk).toBeGreaterThanOrEqual(50);
  });
});
