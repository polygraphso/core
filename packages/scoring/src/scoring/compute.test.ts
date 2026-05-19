import { describe, it, expect } from "vitest";
import {
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

  it("returns the empty-snapshot signature", () => {
    const result = computeRawDimensions(snap(), opts);
    // Adoption: only contribution is neutral velocity (no weekly data
    // → returns 50, the "we don't know yet" sentinel from the lifted
    // formula). 50/100 × log10(1001) × 0.115 ≈ 0.17.
    expect(result.adoption).toBeLessThan(1);
    // Quality: no PR-merge-rate, no OpenSSF — weightedAverage of all-null
    // returns 0.5 (the neutral fallback).
    expect(result.quality).toBe(0.5);
    // Consistency: no publish date → freshness 0 (treated as ancient),
    // no glama/smithery → registry breadth 0. weighted average of two
    // zeros = 0.
    expect(result.consistency).toBe(0);
    // Risk: stale (no last_publish → 9999d) adds 40.
    expect(result.risk).toBeGreaterThanOrEqual(40);
    expect(result.sources_used).toEqual([]);
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
