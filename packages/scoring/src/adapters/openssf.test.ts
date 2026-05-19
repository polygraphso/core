import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchOpenSSF } from "./openssf.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("fetchOpenSSF", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns aggregate score and check map for a scored repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          score: 7.4,
          checks: [
            { name: "Code-Review", score: 8 },
            { name: "Maintained", score: 10 },
            { name: "Vulnerabilities", score: 10 },
            { name: "CI-Tests", score: 6 },
            { name: "Branch-Protection", score: -1 },
            { name: "no-score-field" }, // skipped
          ],
        }),
      ),
    );

    const result = await fetchOpenSSF("modelcontextprotocol", "servers");
    expect(result).toEqual({
      owner: "modelcontextprotocol",
      repo: "servers",
      aggregate_score: 7.4,
      checks: {
        "Code-Review": 8,
        Maintained: 10,
        Vulnerabilities: 10,
        "CI-Tests": 6,
        "Branch-Protection": -1,
      },
    });
  });

  it("returns null when the repo isn't in the Scorecard dataset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    expect(await fetchOpenSSF("nobody", "obscure-repo")).toBeNull();
  });

  it("handles empty checks array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ score: 0 })));
    const result = await fetchOpenSSF("x", "y");
    expect(result?.aggregate_score).toBe(0);
    expect(result?.checks).toEqual({});
  });
});
