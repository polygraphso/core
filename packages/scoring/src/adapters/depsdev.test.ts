import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchDepsDev, cvssToSeverity } from "./depsdev.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("cvssToSeverity", () => {
  it("maps cvss3 scores to severity buckets", () => {
    expect(cvssToSeverity(9.8)).toBe("CRITICAL");
    expect(cvssToSeverity(7.0)).toBe("HIGH");
    expect(cvssToSeverity(6.9)).toBe("MODERATE");
    expect(cvssToSeverity(4.0)).toBe("MODERATE");
    expect(cvssToSeverity(3.9)).toBe("LOW");
    expect(cvssToSeverity(0)).toBe("LOW");
  });
});

describe("fetchDepsDev", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates package + version + advisories + slsa + dependents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/packages/lodash")) {
          return jsonResponse({
            versions: [
              { versionKey: { version: "4.17.20" } },
              { versionKey: { version: "4.17.21" }, isDefault: true },
            ],
          });
        }
        if (input.endsWith("/packages/lodash/versions/4.17.21")) {
          return jsonResponse({
            versionKey: { version: "4.17.21" },
            licenses: ["MIT"],
            advisoryKeys: [{ id: "GHSA-crit" }, { id: "GHSA-high" }, { id: "GHSA-low" }],
            slsaProvenances: [{ source: { uri: "https://example.com" } }],
          });
        }
        if (input.endsWith(":dependents")) {
          return jsonResponse({ dependentCount: 12345 });
        }
        if (input.includes("/advisories/GHSA-crit")) {
          return jsonResponse({ cvss3Score: 9.8 });
        }
        if (input.includes("/advisories/GHSA-high")) {
          return jsonResponse({ cvss3Score: 7.5 });
        }
        if (input.includes("/advisories/GHSA-low")) {
          return jsonResponse({ cvss3Score: 3.1 });
        }
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchDepsDev("lodash", "npm");
    expect(result).toEqual({
      ecosystem: "npm",
      package_name: "lodash",
      latest_version: "4.17.21",
      dependents_count: 12345,
      advisory_count: 3,
      max_advisory_severity: "CRITICAL",
      advisory_severities: ["CRITICAL", "HIGH", "LOW"],
      advisories: [
        { ghsa_id: "GHSA-crit", version: "4.17.21" },
        { ghsa_id: "GHSA-high", version: "4.17.21" },
        { ghsa_id: "GHSA-low", version: "4.17.21" },
      ],
      has_slsa_provenance: true,
      license_detected: "MIT",
    });
  });

  it("returns max_advisory_severity = null and empty list when no advisories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/packages/clean-pkg")) {
          return jsonResponse({
            versions: [
              {
                versionKey: { version: "1.0.0" },
                isDefault: true,
                licenses: ["Apache-2.0"],
              },
            ],
          });
        }
        if (input.endsWith(":dependents")) return jsonResponse({ dependentCount: 0 });
        if (input.includes("/versions/1.0.0") && !input.endsWith(":dependents")) {
          return jsonResponse({
            versionKey: { version: "1.0.0" },
            licenses: ["Apache-2.0"],
            advisoryKeys: [],
          });
        }
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchDepsDev("clean-pkg", "npm");
    expect(result?.advisory_count).toBe(0);
    expect(result?.max_advisory_severity).toBeNull();
    expect(result?.advisory_severities).toEqual([]);
    expect(result?.has_slsa_provenance).toBe(false);
  });

  it("tolerates per-advisory fetch failures and reports what it could fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/packages/half-broken")) {
          return jsonResponse({
            versions: [{ versionKey: { version: "1.0.0" }, isDefault: true }],
          });
        }
        if (input.endsWith("/versions/1.0.0") && !input.endsWith(":dependents")) {
          return jsonResponse({
            versionKey: { version: "1.0.0" },
            advisoryKeys: [{ id: "GHSA-ok" }, { id: "GHSA-missing" }],
          });
        }
        if (input.includes("/advisories/GHSA-ok")) {
          return jsonResponse({ cvss3Score: 8.1 });
        }
        if (input.includes("/advisories/GHSA-missing")) {
          return new Response("Not Found", { status: 404 });
        }
        if (input.endsWith(":dependents")) return jsonResponse({ dependentCount: 0 });
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchDepsDev("half-broken", "npm");
    // Count comes from advisoryKeys length (what's claimed); severities only
    // include what we could actually score.
    expect(result?.advisory_count).toBe(2);
    expect(result?.advisory_severities).toEqual(["HIGH"]);
    expect(result?.max_advisory_severity).toBe("HIGH");
  });

  it("returns null when the package isn't on deps.dev", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    expect(await fetchDepsDev("missing", "npm")).toBeNull();
  });

  it("returns null when the package exists but has no versions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ versions: [] })));
    expect(await fetchDepsDev("empty", "pypi")).toBeNull();
  });
});
