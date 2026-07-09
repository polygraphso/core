import { describe, it, expect } from "vitest";
import { normalizeRepoAdvisory } from "./ghsa.js";

describe("normalizeRepoAdvisory", () => {
  it("normalizes a full repo advisory", () => {
    const a = normalizeRepoAdvisory({
      ghsa_id: "GHSA-xxxx-yyyy-zzzz",
      cve_id: "CVE-2024-1234",
      summary: "path traversal",
      severity: "high",
      html_url: "https://github.com/acme/x/security/advisories/GHSA-xxxx-yyyy-zzzz",
      published_at: "2024-03-03T00:00:00Z",
      withdrawn_at: null,
      cvss: { vector_string: "CVSS:3.1/AV:N", score: 7.5 },
      identifiers: [
        { type: "GHSA", value: "GHSA-xxxx-yyyy-zzzz" },
        { type: "CVE", value: "CVE-2024-1234" },
      ],
      vulnerabilities: [
        { vulnerable_version_range: "< 1.2.0", first_patched_version: { identifier: "1.2.0" } },
      ],
    });
    expect(a).toMatchObject({
      ghsa_id: "GHSA-xxxx-yyyy-zzzz",
      cve_ids: ["CVE-2024-1234"],
      severity: "HIGH",
      cvss: 7.5,
      affected_range: "< 1.2.0",
      fixed_version: "1.2.0",
    });
  });

  it("returns null without a ghsa_id", () => {
    expect(normalizeRepoAdvisory({ summary: "x" })).toBeNull();
  });

  it("falls back to cve_id when identifiers omit CVE", () => {
    const a = normalizeRepoAdvisory({ ghsa_id: "GHSA-a", cve_id: "CVE-2024-5", severity: "low" });
    expect(a?.cve_ids).toEqual(["CVE-2024-5"]);
    expect(a?.severity).toBe("LOW");
    expect(a?.affected_range).toBeNull();
  });
});
