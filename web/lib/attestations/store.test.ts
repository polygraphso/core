import { describe, it, expect } from "vitest";
import { joinRunsWithAttestations } from "./store";

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
});
