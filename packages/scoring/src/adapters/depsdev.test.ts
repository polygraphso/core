import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchDepsDev } from "./depsdev.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("fetchDepsDev", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates package + version + dependents into adapter data", async () => {
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
            advisoryKeys: [{ id: "GHSA-foo" }, { id: "GHSA-bar" }, {}],
          });
        }
        if (input.endsWith(":dependents")) {
          return jsonResponse({ dependentCount: 12345 });
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
      advisory_count: 2,
      license_detected: "MIT",
    });
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

  it("falls back to the default version object when the version-detail endpoint 404s", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/packages/foo")) {
          return jsonResponse({
            versions: [
              {
                versionKey: { version: "0.1.0" },
                isDefault: true,
                licenses: ["Apache-2.0"],
                advisoryKeys: [],
              },
            ],
          });
        }
        if (input.includes("/versions/0.1.0") && !input.endsWith(":dependents")) {
          return new Response("Not Found", { status: 404 });
        }
        if (input.endsWith(":dependents")) {
          return jsonResponse({ dependentCount: 0 });
        }
        throw new Error(`Unexpected URL: ${input}`);
      }),
    );

    const result = await fetchDepsDev("foo", "pypi");
    expect(result?.license_detected).toBe("Apache-2.0");
    expect(result?.advisory_count).toBe(0);
  });
});
