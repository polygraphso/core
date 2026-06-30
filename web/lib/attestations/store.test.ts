import { describe, it, expect } from "vitest";
import { joinRunsWithAttestations, latestPerTarget } from "./store";

const runs = [
  { id: 1, target: "npm/a", grade: "A", evidence: { resolvedVersion: "1.0.0" } },
  { id: 2, target: "npm/b", grade: "C", evidence: { resolvedVersion: null } },
];

describe("joinRunsWithAttestations", () => {
  it("marks runs with no attestation as 'none'", () => {
    const out = joinRunsWithAttestations(runs, []);
    expect(out[0]).toMatchObject({ hosted_run_id: "1", server: "npm/a", version: "1.0.0", grade: "A", status: "none" });
    expect(out[1].version).toBe("");
  });

  it("attaches the most recent attestation per run", () => {
    const atts = [
      { hosted_run_id: "1", status: "confirmed", attestation_uid: "0xnew", error: null },
      { hosted_run_id: "1", status: "failed", attestation_uid: null, error: "old" },
    ];
    const out = joinRunsWithAttestations(runs, atts);
    expect(out[0]).toMatchObject({ status: "confirmed", attestation_uid: "0xnew" });
  });

  it("maps the litmus (methodology) version and the published flag", () => {
    const withMeta = [
      {
        id: 1,
        target: "npm/a",
        target_kind: "registry_ref",
        grade: "A",
        evidence: { resolvedVersion: "1.0.0" },
        methodology_version: "litmus-v10",
        published_at: "2026-06-30T00:00:00Z",
      },
      {
        id: 2,
        target: "github/o/r#s",
        target_kind: "skill",
        grade: "B",
        evidence: null,
        methodology_version: "litmus-skill-v2",
        published_at: null,
      },
    ];
    const out = joinRunsWithAttestations(withMeta, []);
    expect(out[0]).toMatchObject({ methodology_version: "litmus-v10", published: true });
    expect(out[1]).toMatchObject({ methodology_version: "litmus-skill-v2", published: false });
  });

  it("defaults a missing methodology version to '—'", () => {
    const [row] = joinRunsWithAttestations(
      [{ id: 9, target: "npm/x", grade: "A", evidence: null }],
      [],
    );
    expect(row.methodology_version).toBe("—");
    expect(row.published).toBe(false);
  });
});

describe("latestPerTarget", () => {
  it("keeps only the newest run per (target, target_kind); input ordered newest-first", () => {
    const runs = [
      { id: 3, target: "npm/a", target_kind: "registry_ref", grade: "B", evidence: null },
      { id: 2, target: "npm/a", target_kind: "registry_ref", grade: "A", evidence: null },
      { id: 1, target: "npm/b", target_kind: "registry_ref", grade: "A", evidence: null },
    ];
    expect(latestPerTarget(runs).map((r) => r.id)).toEqual([3, 1]);
  });

  it("treats the same target under different kinds as distinct rows", () => {
    const runs = [
      { id: 1, target: "x", target_kind: "skill", grade: "A", evidence: null },
      { id: 2, target: "x", target_kind: "registry_ref", grade: "A", evidence: null },
    ];
    expect(latestPerTarget(runs)).toHaveLength(2);
  });
});
